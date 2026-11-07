import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { createAccountStore } from "./account-store.mjs";
import { mergeDovecotUser, mergePostfixAccounts, parseDovecotUsers } from "./account-core.mjs";

const domains = ["example.com", "post.example.com"];
const password = "synthetic-account-password";

async function fixture(callback) {
  // Test data and credentials stay in the checkout and are always removed.
  const directory = await fs.mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), ".account-test-"));
  const users = path.join(directory, "dovecot-users");
  const recipients = path.join(directory, "virtual-mailbox-accounts");
  const legacy = path.join(directory, "users.json");
  const options = { directory, domains, legacyUsersPath: legacy };
  await fs.writeFile(users, "# original accounts\n", { mode: 0o640 });
  await fs.writeFile(recipients, "# original recipients\n", { mode: 0o640 });
  try { await callback({ directory, users, recipients, legacy, options, store: createAccountStore(options) }); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

test("legacy account IDs require their original password before migration", async () => fixture(async (f) => {
  const salt = crypto.randomBytes(16).toString("base64url");
  const legacyRaw = JSON.stringify([{ id: "owner", salt,
    passwordHash: crypto.scryptSync(password, salt, 64).toString("base64url") }]);
  await fs.writeFile(f.legacy, legacyRaw, { mode: 0o600 });
  await assert.rejects(f.store.provision("owner", "different-synthetic-password"), { code: "ACCOUNT_EXISTS" });
  assert.equal(await fs.readFile(f.users, "utf8"), "# original accounts\n");
  assert.equal(await fs.readFile(f.recipients, "utf8"), "# original recipients\n");
  await f.store.provision("owner", password);
  const account = parseDovecotUsers(await fs.readFile(f.users, "utf8"))[0];
  assert.equal(await bcrypt.compare(password, account.passwordHash.slice("{BLF-CRYPT}".length)), true);
  assert.match(await fs.readFile(f.recipients, "utf8"), /owner@example\.com owner\/Maildir\//);
  assert.equal(await fs.readFile(f.legacy, "utf8"), legacyRaw);
}));

test("unreadable legacy metadata cannot silently release a reserved ID", async () => fixture(async (f) => {
  await fs.writeFile(f.legacy, "invalid legacy JSON");
  await assert.rejects(f.store.provision("owner", password), /Invalid legacy account store/);
  await fs.writeFile(f.legacy, JSON.stringify([{ id: "owner" }]));
  await assert.rejects(f.store.provision("owner", password), { code: "ACCOUNT_EXISTS" });
  assert.equal(await fs.readFile(f.users, "utf8"), "# original accounts\n");
}));

test("rejects truncated-password and traversal attempts before persisting anything", async () => fixture(async (f) => {
  for (const candidate of ["가".repeat(24) + "a", "가".repeat(24) + "b", "a".repeat(73)]) {
    await assert.rejects(f.store.provision("owner", candidate), /Invalid password length/);
  }
  for (const id of [".", "..", "../other"]) await assert.rejects(f.store.provision(id, password), /Invalid user id/);
  assert.equal(await fs.readFile(f.users, "utf8"), "# original accounts\n");
  assert.equal(await fs.readFile(f.recipients, "utf8"), "# original recipients\n");
  await f.store.provision("owner", "가".repeat(24));
  const account = parseDovecotUsers(await fs.readFile(f.users, "utf8"))[0];
  assert.equal(await bcrypt.compare("가".repeat(24), account.passwordHash.slice("{BLF-CRYPT}".length)), true);
}));

test("restarts after a real process kill between the two account-file renames", async () => fixture(async (f) => {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { promises as fs } from 'node:fs';
    import path from 'node:path';
    import { createAccountStore } from './account-store.mjs';
    const directory = process.env.FIXTURE_ACCOUNT_DIR;
    const io = { ...fs, async rename(from, to) {
      await fs.rename(from, to);
      if (to === path.join(directory, 'dovecot-users')) process.kill(process.pid, 'SIGKILL');
    }};
    await createAccountStore({ directory, domains: ['example.com', 'post.example.com'], io })
      .provision('owner', 'synthetic-account-password');
  `], { cwd: path.dirname(fileURLToPath(import.meta.url)), encoding: "utf8", timeout: 10_000,
    env: { ...process.env, FIXTURE_ACCOUNT_DIR: f.directory } });
  assert.equal(child.signal, "SIGKILL");
  assert.match(await fs.readFile(f.users, "utf8"), /owner:/);
  assert.equal(await fs.readFile(f.recipients, "utf8"), "# original recipients\n");
  const journal = path.join(f.directory, ".provision.pending.json");
  assert.equal((await fs.stat(journal)).mode & 0o777, 0o600);
  const expired = new Date(Date.now() - 31_000);
  await fs.utimes(path.join(f.directory, ".signup.lock"), expired, expired);
  const events = [];
  const restarted = createAccountStore({ ...f.options, onRecovery: (event) => events.push(event) });
  await restarted.recover();
  assert.deepEqual(events, ["auth.account.recovered"]);
  assert.match(await fs.readFile(f.recipients, "utf8"), /owner@example\.com owner\/Maildir\//);
  await assert.rejects(fs.stat(journal), { code: "ENOENT" });
  const before = await fs.readFile(f.users, "utf8");
  await restarted.recover();
  assert.equal(await fs.readFile(f.users, "utf8"), before);
  await assert.rejects(restarted.provision("owner", password), { code: "ACCOUNT_EXISTS" });
}));

test("recovery refuses to overwrite unrelated edits after an interrupted signup", async () => fixture(async (f) => {
  const io = { ...fs, async rename(from, to) {
    if (to === f.recipients) throw Object.assign(new Error("Injected recipient write failure"), { code: "EIO" });
    await fs.rename(from, to);
  } };
  await assert.rejects(createAccountStore({ ...f.options, io }).provision("owner", password), { code: "EIO" });
  const edited = (await fs.readFile(f.users, "utf8")) + "# operator edit\n";
  await fs.writeFile(f.users, edited);
  await assert.rejects(f.store.recover(), /conflicts with current account files/);
  assert.equal(await fs.readFile(f.users, "utf8"), edited);
  assert.equal(await fs.readFile(f.recipients, "utf8"), "# original recipients\n");
}));

test("repairs pre-journal partial accounts while preserving existing hashes and aliases", async () => fixture(async (f) => {
  const hash = `{BLF-CRYPT}${await bcrypt.hash(password, 4)}`;
  const users = mergeDovecotUser("", "owner", hash);
  await fs.writeFile(f.users, users);
  await fs.writeFile(f.recipients, "alias@example.com existing/Maildir/\n");
  await f.store.recover();
  assert.equal(await fs.readFile(f.users, "utf8"), users);
  assert.match(await fs.readFile(f.recipients, "utf8"), /alias@example\.com existing\/Maildir\//);
  for (const domain of domains) assert((await fs.readFile(f.recipients, "utf8")).includes(`owner@${domain} owner/Maildir/`));
}));

test("concurrent signups retain both account and recipient records", async () => fixture(async (f) => {
  await Promise.all([f.store.provision("first", password), createAccountStore(f.options).provision("second", password)]);
  assert.deepEqual(parseDovecotUsers(await fs.readFile(f.users, "utf8")).map((item) => item.id), ["first", "second"]);
  const recipients = await fs.readFile(f.recipients, "utf8");
  for (const id of ["first", "second"]) for (const domain of domains) assert(recipients.includes(`${id}@${domain} ${id}/Maildir/`));
  const expected = mergePostfixAccounts(mergePostfixAccounts("", "first", domains), "second", domains);
  assert.equal(recipients, expected);
}));
