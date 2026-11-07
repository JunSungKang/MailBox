import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
import { isValidPassword, isValidUserId, normalizeUserId } from "./auth-core.mjs";
import { mergeDovecotUser, mergePostfixAccounts, parseDovecotUsers } from "./account-core.mjs";

const scrypt = promisify(crypto.scrypt);
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const accountExists = () => Object.assign(new Error("Account already exists"), { code: "ACCOUNT_EXISTS" });

export function createAccountStore({ directory, legacyUsersPath, domains, onRecovery = () => {}, io = fs }) {
  const root = path.resolve(directory);
  const usersPath = path.join(root, "dovecot-users");
  const recipientsPath = path.join(root, "virtual-mailbox-accounts");
  const lockPath = path.join(root, ".signup.lock");
  const pendingPath = path.join(root, ".provision.pending.json");

  async function atomicWrite(file, content, mode = 0o640) {
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      await io.writeFile(temporary, content, { encoding: "utf8", mode, flag: "wx" });
      await io.rename(temporary, file);
    } finally {
      await io.rm(temporary, { force: true });
    }
  }

  async function withLock(callback) {
    await io.mkdir(root, { recursive: true });
    let handle;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        handle = await io.open(lockPath, "wx", 0o600);
        break;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
        const stat = await io.stat(lockPath).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > 30_000) await io.unlink(lockPath).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    if (!handle) throw new Error("Account store is busy");
    try {
      return await callback();
    } finally {
      await handle.close();
      await io.unlink(lockPath);
    }
  }

  async function readAccounts() {
    const [dovecot, postfix] = await Promise.all([
      io.readFile(usersPath, "utf8"), io.readFile(recipientsPath, "utf8")
    ]);
    return { dovecot, postfix };
  }

  async function recoverPending() {
    const raw = await io.readFile(pendingPath, "utf8").catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (raw === null) return false;
    let pending;
    try { pending = JSON.parse(raw); } catch { throw new Error("Invalid account recovery journal"); }
    if (pending?.version !== 1 || !["dovecot", "postfix"].every((key) =>
      typeof pending.after?.[key] === "string" && /^[a-f0-9]{64}$/.test(pending.before?.[key] || ""))) {
      throw new Error("Invalid account recovery journal");
    }
    const current = await readAccounts();
    // Stop rather than overwrite an operator's unrelated account-file edits.
    for (const key of ["dovecot", "postfix"]) {
      if (![pending.before[key], digest(pending.after[key])].includes(digest(current[key]))) {
        throw new Error("Account recovery conflicts with current account files");
      }
    }
    if (current.dovecot !== pending.after.dovecot) await atomicWrite(usersPath, pending.after.dovecot);
    if (current.postfix !== pending.after.postfix) await atomicWrite(recipientsPath, pending.after.postfix);
    await io.unlink(pendingPath);
    onRecovery("auth.account.recovered");
    return true;
  }

  async function verifyLegacyOwnership(userId, password) {
    if (!legacyUsersPath) return;
    const raw = await io.readFile(legacyUsersPath, "utf8").catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (raw === null) return;
    let users;
    try { users = JSON.parse(raw); } catch { throw new Error("Invalid legacy account store"); }
    if (!Array.isArray(users)) throw new Error("Invalid legacy account store");
    const reserved = users.filter((user) => typeof user?.id === "string" && normalizeUserId(user.id) === userId);
    if (!reserved.length) return;
    // An invite code permits signup; it does not prove ownership of existing mail.
    if (reserved.length !== 1 || typeof reserved[0].salt !== "string" || typeof reserved[0].passwordHash !== "string") {
      throw accountExists();
    }
    const derived = (await scrypt(password, reserved[0].salt, 64)).toString("base64url");
    const expected = reserved[0].passwordHash;
    if (derived.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected))) {
      throw accountExists();
    }
  }

  async function reconcileRecipients() {
    const current = await readAccounts();
    const entries = new Map(current.postfix.split(/\r?\n/).map((line) => line.trim().split(/\s+/, 2)));
    let next = current.postfix;
    for (const account of parseDovecotUsers(current.dovecot)) {
      if (domains.some((domain) => entries.get(`${account.id}@${domain}`) !== `${account.id}/Maildir/`)) {
        next = mergePostfixAccounts(next, account.id, domains);
      }
    }
    if (next !== current.postfix) {
      await atomicWrite(recipientsPath, next);
      onRecovery("auth.account.reconciled");
    }
  }

  return {
    async recover() {
      return withLock(async () => {
        await recoverPending();
        // Also repairs a pre-journal interrupted signup after upgrading.
        await reconcileRecipients();
      });
    },
    async provision(userId, password) {
      if (!isValidUserId(userId)) throw new Error("Invalid user id");
      if (!isValidPassword(password)) throw new Error("Invalid password length");
      return withLock(async () => {
        await recoverPending();
        const before = await readAccounts();
        if (parseDovecotUsers(before.dovecot).some((account) => account.id === userId)) throw accountExists();
        await verifyLegacyOwnership(userId, password);
        const passwordHash = `{BLF-CRYPT}${await bcrypt.hash(password, 12)}`;
        const after = {
          dovecot: mergeDovecotUser(before.dovecot, userId, passwordHash),
          postfix: mergePostfixAccounts(before.postfix, userId, domains)
        };
        await atomicWrite(pendingPath, JSON.stringify({ version: 1,
          before: { dovecot: digest(before.dovecot), postfix: digest(before.postfix) }, after }), 0o600);
        await atomicWrite(usersPath, after.dovecot);
        await atomicWrite(recipientsPath, after.postfix);
        await io.unlink(pendingPath);
        return { addressCount: domains.length, domains };
      });
    }
  };
}
