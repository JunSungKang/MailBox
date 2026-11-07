import assert from "node:assert/strict";
import test from "node:test";

import { isValidPassword, isValidUserId, sessionToken, verifySessionToken } from "./auth-core.mjs";

const secret = "test-secret-at-least-32-characters-long";

test("accepts a valid signed session", () => {
  assert.equal(verifySessionToken(sessionToken("jskang", secret), secret), "jskang");
});

test("rejects a forged user or signature", () => {
  const valid = sessionToken("jskang", secret);
  assert.equal(verifySessionToken(valid.replace("jskang", "mailbox"), secret), "");
  assert.equal(verifySessionToken("jskang.invalid", secret), "");
});

test("rejects a session signed by another secret", () => {
  const valid = sessionToken("jskang", secret);
  assert.equal(verifySessionToken(valid, "another-test-secret-at-least-32-chars"), "");
});

test("rejects directory identifiers before issuing a usable session", () => {
  for (const id of [".", "..", "../other", "other/user"]) {
    assert.equal(isValidUserId(id), false);
    assert.equal(verifySessionToken(sessionToken(id, secret), secret), "");
  }
  for (const id of ["damgo-x2", "a.b", "_account", "..."]) assert.equal(isValidUserId(id), true);
});

test("bounds new passwords by UTF-8 bytes at bcrypt's 72-byte limit", () => {
  for (const password of ["a".repeat(72), "가".repeat(24), "😀".repeat(18)]) assert.equal(isValidPassword(password), true);
  for (const password of ["a".repeat(73), "가".repeat(24) + "a", "😀".repeat(19), "short", null]) {
    assert.equal(isValidPassword(password), false);
  }
});

test("rejects NUL credentials that cannot authenticate through SASL PLAIN", () => {
  for (const password of ["\0synthetic-password", "synthetic\0password", "synthetic-password\0"]) {
    assert.equal(isValidPassword(password), false);
    const form = new URLSearchParams(new URLSearchParams({ password }).toString());
    assert.equal(isValidPassword(form.get("password")), false);
  }
});
