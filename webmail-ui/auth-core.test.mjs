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

test("preserves the requested 8-128 character range without a byte ceiling", () => {
  for (const password of ["a".repeat(8), "a".repeat(73), "a".repeat(128), "가".repeat(128), "😀".repeat(64)]) assert.equal(isValidPassword(password), true);
  for (const password of ["a".repeat(7), "a".repeat(129), "가".repeat(129), null]) {
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
