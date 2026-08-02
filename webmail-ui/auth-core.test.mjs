import assert from "node:assert/strict";
import test from "node:test";

import { sessionToken, verifySessionToken } from "./auth-core.mjs";

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
