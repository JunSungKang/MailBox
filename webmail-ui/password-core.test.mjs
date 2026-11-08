import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { hashPassword, isSupportedPasswordHash, verifyPassword } from "./password-core.mjs";

test("new credentials use random-salted Dovecot Argon2id without storing plaintext", async () => {
  const password = "synthetic-password";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(isSupportedPasswordHash(first), true);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("different-password", first), false);
});

test("all 128 characters affect authentication, including multibyte passwords", async () => {
  for (const prefix of ["a".repeat(127), "가".repeat(127)]) {
    const encoded = await hashPassword(prefix + "A");
    assert.equal(await verifyPassword(prefix + "A", encoded), true);
    assert.equal(await verifyPassword(prefix + "B", encoded), false);
    assert.equal(await verifyPassword(prefix.slice(0, 72), encoded), false);
  }
});

test("eight-character credentials work while invalid new lengths and NUL are rejected", async () => {
  const password = "Abcdef8!";
  assert.equal(await verifyPassword(password, await hashPassword(password)), true);
  for (const invalid of ["a".repeat(7), "a".repeat(129), "synthetic\0password"]) await assert.rejects(hashPassword(invalid));
});

test("legacy bcrypt credentials remain readable without a password or hash migration", async () => {
  const password = "old-fixture-password";
  const encoded = `{BLF-CRYPT}${await bcrypt.hash(password, 4)}`;
  assert.equal(isSupportedPasswordHash(encoded), true);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("wrong-fixture-password", encoded), false);
  assert.equal(encoded.startsWith("{BLF-CRYPT}"), true);
});

test("unsupported or excessive-cost hash profiles fail closed", async () => {
  const encoded = await hashPassword("synthetic-password");
  for (const invalid of [encoded.replace("m=65536", "m=4294967295"), encoded.replace("t=3", "t=99999"),
    encoded + ":injected", encoded + "\n", "{PLAIN}synthetic-password", "{BLF-CRYPT}$2b$12$invalid"]) {
    assert.equal(isSupportedPasswordHash(invalid), false);
    assert.equal(await verifyPassword("synthetic-password", invalid), false);
  }
});
