import crypto from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
import { isValidPassword } from "./auth-core.mjs";

const derive = promisify(crypto.argon2);
const profile = { parallelism: 1, tagLength: 32, memory: 65536, passes: 3 };
const bcryptPattern = /^\{BLF-CRYPT\}\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;
const argonPattern = /^\{ARGON2ID\}\$argon2id\$v=19\$m=65536,t=3,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/;
const encode = (bytes) => bytes.toString("base64").replace(/=+$/, "");
const isBcrypt = (encoded) => bcryptPattern.exec(encoded)?.[0] === encoded;

function parseArgon2(encoded) {
  const match = argonPattern.exec(encoded);
  if (!match || match[0] !== encoded) return null;
  const salt = Buffer.from(match[1], "base64");
  const tag = Buffer.from(match[2], "base64");
  if (salt.length !== 16 || tag.length !== 32 || encode(salt) !== match[1] || encode(tag) !== match[2]) return null;
  return { salt, tag };
}

export function isSupportedPasswordHash(encoded) {
  return typeof encoded === "string" && (isBcrypt(encoded) || parseArgon2(encoded) !== null);
}

export async function hashPassword(password) {
  if (!isValidPassword(password)) throw new Error("Invalid password length or character");
  const salt = crypto.randomBytes(16);
  const tag = await derive("argon2id", { ...profile, message: password, nonce: salt });
  return `{ARGON2ID}$argon2id$v=19$m=65536,t=3,p=1$${encode(salt)}$${encode(tag)}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;
  // Retain existing credential behavior without rewriting any stored bcrypt hash.
  if (isBcrypt(encoded)) return bcrypt.compare(password, encoded.slice("{BLF-CRYPT}".length));
  if (!isValidPassword(password)) return false;
  const parsed = parseArgon2(encoded);
  if (!parsed) return false;
  // Only the application's bounded profile is accepted; file data cannot select
  // arbitrary memory/CPU costs during an unauthenticated login attempt.
  const actual = await derive("argon2id", { ...profile, message: password, nonce: parsed.salt });
  return crypto.timingSafeEqual(actual, parsed.tag);
}
