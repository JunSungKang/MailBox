import test from "node:test";
import assert from "node:assert/strict";
import { planImmutableTags, assemblyArguments } from "./promotion.mjs";
const tags = ["sha-source", "v0.2.0"];
const value = { digest: "sha256:" + "a".repeat(64) };
test("different immutable root digests are rejected even when children match", () => {
  assert.throws(() => planImmutableTags(tags, { [tags[0]]: value, [tags[1]]: { digest: "sha256:" + "b".repeat(64) } }), /disagree/);
});
test("existing immutable tags are never scheduled for replacement", () => {
  const full = planImmutableTags(tags, { [tags[0]]: value, [tags[1]]: value });
  assert.deepEqual(full.missing, []); assert.equal(full.existingDigest, value.digest);
  for (const existingTag of tags) {
    const partial = planImmutableTags(tags, { [existingTag]: value });
    assert.equal(partial.existingDigest, value.digest);
    assert.deepEqual(partial.missing, tags.filter(tag => tag !== existingTag));
    assert.equal(partial.preserved[existingTag], value.digest);
  }
  assert.deepEqual(planImmutableTags(tags, {}).missing, tags);
});
test("Docker and OCI assembly retains config metadata without index annotations", () => {
  const args = assemblyArguments("ghcr.io/owner/image", tags, ["source-amd64", "source-arm64"]);
  assert(!args.some(x => x.includes("annotation")));
  assert.deepEqual(args.slice(-2), ["source-amd64", "source-arm64"]);
});
