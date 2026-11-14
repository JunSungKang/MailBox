import test from "node:test";
import assert from "node:assert/strict";
import { sourceArchiveUrl } from "./src/lib/sourceLink.ts";

test("published source offer points to the exact full build revision", () => {
  const revision = "abc123".repeat(6) + "abcd";
  assert.equal(sourceArchiveUrl(revision), `https://github.com/JunSungKang/MailBox/archive/${revision}.tar.gz`);
});
test("unversioned development builds offer main source", () => {
  for (const value of ["", "unknown", "v0.2.0"]) assert.equal(sourceArchiveUrl(value), "https://github.com/JunSungKang/MailBox/archive/main.tar.gz");
});
test("source offers cannot redirect to arbitrary hosts or paths", () => {
  for (const value of ["https://example.invalid", "../../private", "abc123?token=secret"]) {
    assert.equal(sourceArchiveUrl(value), "https://github.com/JunSungKang/MailBox/archive/main.tar.gz");
  }
});
