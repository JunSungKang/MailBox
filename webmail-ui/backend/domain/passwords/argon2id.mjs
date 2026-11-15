import crypto from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(crypto.argon2);
const profile = { parallelism: 1, tagLength: 32, memory: 65536, passes: 3 };
const argonPattern =
  /^\{ARGON2ID\}\$argon2id\$v=19\$m=65536,t=3,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/;
const encode = (bytes) => bytes.toString("base64").replace(/=+$/, "");

export function parseArgon2(encoded) {
  const match = argonPattern.exec(encoded);
  if (!match || match[0] !== encoded) return null;
  const salt = Buffer.from(match[1], "base64");
  const tag = Buffer.from(match[2], "base64");
  if (
    salt.length !== 16 ||
    tag.length !== 32 ||
    encode(salt) !== match[1] ||
    encode(tag) !== match[2]
  )
    return null;
  return { salt, tag };
}

export async function hashArgon2id(password) {
  const salt = crypto.randomBytes(16);
  const tag = await derive("argon2id", {
    ...profile,
    message: password,
    nonce: salt,
  });
  return `{ARGON2ID}$argon2id$v=19$m=65536,t=3,p=1$${encode(salt)}$${encode(tag)}`;
}

export async function verifyArgon2id(password, parsed) {
  const actual = await derive("argon2id", {
    ...profile,
    message: password,
    nonce: parsed.salt,
  });
  return crypto.timingSafeEqual(actual, parsed.tag);
}
