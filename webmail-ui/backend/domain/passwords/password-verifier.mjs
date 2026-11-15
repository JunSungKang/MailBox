import { isValidPassword } from "../session.mjs";
import { isBcrypt, verifyBcrypt } from "./bcrypt.mjs";
import { parseArgon2, hashArgon2id, verifyArgon2id } from "./argon2id.mjs";
export function isSupportedPasswordHash(encoded) {
  return (
    typeof encoded === "string" &&
    (isBcrypt(encoded) || parseArgon2(encoded) !== null)
  );
}
export async function hashPassword(password) {
  if (!isValidPassword(password))
    throw Error("Invalid password length or character");
  return hashArgon2id(password);
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;
  if (isBcrypt(encoded)) return verifyBcrypt(password, encoded);
  if (!isValidPassword(password)) return false;
  const parsed = parseArgon2(encoded);
  return parsed ? verifyArgon2id(password, parsed) : false;
}
