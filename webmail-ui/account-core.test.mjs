import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";

import { dovecotUserLine, mergeDovecotUser, mergePostfixAccounts, parseDomains, parseDovecotUsers } from "./account-core.mjs";

const hash = `{BLF-CRYPT}${bcrypt.hashSync("synthetic-account-password", 4)}`;

test("normalizes configured mail domains", () => {
  assert.deepEqual(parseDomains("Example.com example.com, post.example.com invalid"), ["example.com", "post.example.com"]);
});

test("adds and parses a Dovecot passwd-file account", () => {
  const output = mergeDovecotUser("# managed\n", "newuser", hash);
  assert.deepEqual(parseDovecotUsers(output).map((account) => account.id), ["newuser"]);
  assert.throws(() => mergeDovecotUser(output, "newuser", hash), /already exists/);
});

test("adds per-domain Postfix mappings to an isolated Maildir", () => {
  const output = mergePostfixAccounts("mailbox@example.com mailbox/Maildir/\n", "newuser", ["example.com", "post.example.com"]);
  assert.match(output, /newuser@example\.com newuser\/Maildir\//);
  assert.match(output, /newuser@post\.example\.com newuser\/Maildir\//);
});

test("never creates an account or recipient outside the Maildir user directory", () => {
  for (const id of [".", "..", "../other", "other/user"]) {
    assert.throws(() => dovecotUserLine(id, hash), /Invalid user id/);
    assert.throws(() => mergeDovecotUser("", id, hash), /Invalid user id/);
    assert.throws(() => mergePostfixAccounts("", id, ["example.com"]), /Invalid user id/);
  }
});

test("creates a Dovecot-compatible bcrypt credential without storing plaintext", async () => {
  const password = "a-long-test-password";
  const credential = `{BLF-CRYPT}${await bcrypt.hash(password, 4)}`;
  const output = mergeDovecotUser("", "newuser", credential);
  const stored = parseDovecotUsers(output)[0].passwordHash;
  assert.equal(output.includes(password), false);
  assert.equal(await bcrypt.compare(password, stored.slice("{BLF-CRYPT}".length)), true);
});
