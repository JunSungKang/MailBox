import { promises as fs } from "node:fs";
import { parseDovecotUsers } from "../domain/account-format.mjs";
import { verifyPassword } from "../domain/passwords/password-verifier.mjs";
export function createAuthenticator({
  usersPath,
  io = fs,
  verify = verifyPassword,
}) {
  return async (userId, password) => {
    const raw = await io.readFile(usersPath, "utf8").catch(() => "");
    const account = parseDovecotUsers(raw).find((item) => item.id === userId);
    return account ? verify(password, account.passwordHash) : false;
  };
}
