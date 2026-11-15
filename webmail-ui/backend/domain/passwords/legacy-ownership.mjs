import crypto from "node:crypto";
import { promisify } from "node:util";
import { normalizeUserId } from "../session.mjs";
const scrypt = promisify(crypto.scrypt);
const accountExists = () =>
  Object.assign(Error("Account already exists"), { code: "ACCOUNT_EXISTS" });
export async function verifyLegacyOwnership({
  userId,
  password,
  legacyUsersPath,
  io,
}) {
  if (!legacyUsersPath) return false;
  const raw = await io.readFile(legacyUsersPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (raw === null) return false;
  let users;
  try {
    users = JSON.parse(raw);
  } catch {
    throw new Error("Invalid legacy account store");
  }
  if (!Array.isArray(users)) throw new Error("Invalid legacy account store");
  const reserved = users.filter(
    (user) =>
      typeof user?.id === "string" && normalizeUserId(user.id) === userId,
  );
  if (!reserved.length) return false;
  // Public signup must still prove ownership of an existing legacy account.
  if (
    reserved.length !== 1 ||
    typeof reserved[0].salt !== "string" ||
    typeof reserved[0].passwordHash !== "string"
  ) {
    throw accountExists();
  }
  const derived = (await scrypt(password, reserved[0].salt, 64)).toString(
    "base64url",
  );
  const expected = reserved[0].passwordHash;
  if (
    derived.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected))
  ) {
    throw accountExists();
  }
  return true;
}
