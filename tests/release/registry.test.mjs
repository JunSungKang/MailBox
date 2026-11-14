import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { architecture, assertCurrentMain } from "./registry.mjs";
const revision = "a".repeat(40);
const digest = value => "sha256:" + crypto.createHash("sha256").update(value).digest("hex");
async function fixture(callback, { labels = {}, corrupt = false, duplicate = false } = {}) {
  const config = JSON.stringify({ os: "linux", architecture: "arm64", config: { Labels: {
    "org.opencontainers.image.source": "https://github.com/JunSungKang/MailBox", "org.opencontainers.image.licenses": "AGPL-3.0-only",
    "org.opencontainers.image.revision": revision, "org.opencontainers.image.version": "0.2.0", ...labels } } });
  const image = JSON.stringify({ config: { digest: digest(config) } });
  const descriptor = { platform: { os: "linux", architecture: "arm64" }, digest: digest(image) };
  const index = JSON.stringify({ manifests: duplicate ? [descriptor, descriptor] : [descriptor] });
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("/token?")) return Response.json({ token: "synthetic-public-pull-token" });
    const bytes = String(url).includes("/blobs/") ? (corrupt ? config + " " : config) : String(url).endsWith(digest(image)) ? image : index;
    return new Response(bytes, { headers: { "docker-content-digest": digest(bytes) } });
  };
  try { await callback(); } finally { globalThis.fetch = original; }
}
test("public package verification binds architecture, source, version and license", async () => fixture(async () => {
  const result = await architecture("junsungkang/fixture-valid", "build", "arm64", revision, "0.2.0");
  assert.equal(result.architecture, "arm64"); assert.match(result.configDigest, /^sha256:[a-f0-9]{64}$/);
}));
test("wrong source/license and altered config cannot pass package promotion", async () => {
  for (const labels of [{ "org.opencontainers.image.revision": "b".repeat(40) }, { "org.opencontainers.image.licenses": "Apache-2.0" }]) {
    await fixture(() => assert.rejects(architecture("junsungkang/fixture-invalid", "build", "arm64", revision, "0.2.0")), { labels });
  }
  await fixture(() => assert.rejects(architecture("junsungkang/fixture-corrupt", "build", "arm64", revision, "0.2.0")), { corrupt: true });
  await fixture(() => assert.rejects(architecture("junsungkang/fixture-duplicate", "build", "arm64", revision, "0.2.0")), { duplicate: true });
});
test("publication refuses forks, non-main refs and a stale main SHA", async () => {
  const originalFetch = globalThis.fetch;
  const keys = ["GITHUB_ACTIONS", "GITHUB_REPOSITORY", "GITHUB_REF", "GITHUB_SHA"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "JunSungKang/MailBox", GITHUB_REF: "refs/heads/main", GITHUB_SHA: revision });
    globalThis.fetch = async () => Response.json({ object: { sha: "b".repeat(40) } });
    await assert.rejects(assertCurrentMain());
    process.env.GITHUB_REPOSITORY = "fork/MailBox"; await assert.rejects(assertCurrentMain());
    process.env.GITHUB_REPOSITORY = "JunSungKang/MailBox"; process.env.GITHUB_REF = "refs/heads/develop"; await assert.rejects(assertCurrentMain());
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
});
