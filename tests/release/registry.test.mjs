import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { architecture, assertCurrentMain, manifest, waitForRegistry, visibleManifest } from "./registry.mjs";
const revision = "a".repeat(40);
const digest = value => "sha256:" + crypto.createHash("sha256").update(value).digest("hex");
async function fixture(callback, { labels = {}, corrupt = false, duplicate = false, wrongDescriptor = false, missing = {}, status } = {}) {
  const config = JSON.stringify({ os: "linux", architecture: "arm64", config: { Labels: {
    "org.opencontainers.image.source": "https://github.com/JunSungKang/MailBox", "org.opencontainers.image.licenses": "AGPL-3.0-only",
    "org.opencontainers.image.revision": revision, "org.opencontainers.image.version": "0.2.0", ...labels } } });
  const image = JSON.stringify({ config: { digest: digest(config) } });
  const descriptor = { platform: { os: "linux", architecture: "arm64" }, digest: wrongDescriptor ? "sha256:" + "0".repeat(64) : digest(image) };
  const index = JSON.stringify({ manifests: duplicate ? [descriptor, descriptor] : [descriptor] });
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("/token?")) return Response.json({ token: "synthetic-public-pull-token" });
    const kind = String(url).includes("/blobs/") ? "config" : String(url).endsWith("/manifests/build") ? "root" : "child";
    if (missing[kind] > 0) { missing[kind]--; return new Response("", { status: 404 }); }
    if (status) return new Response("", { status });
    const bytes = String(url).includes("/blobs/") ? (corrupt ? config + " " : config) : String(url).endsWith("/manifests/build") ? index : image;
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
test("a self-consistent response for a different descriptor is rejected", async () => fixture(
  () => assert.rejects(architecture("junsungkang/fixture-wrong-descriptor", "build", "arm64", revision, "0.2.0"), /requested descriptor/),
  { wrongDescriptor: true }
));
test("post-push verification tolerates delayed root, child and config visibility", async () => fixture(async () => {
  const delays = [];
  const value = await waitForRegistry(() => architecture("junsungkang/fixture-delayed", "build", "arm64", revision, "0.2.0"),
    { attempts: 4, intervalMs: 5, wait: async ms => delays.push(ms) });
  assert.equal(value.architecture, "arm64"); assert.deepEqual(delays, [5, 5, 5]);
}, { missing: { root: 1, child: 1, config: 1 } }));
test("visibility exhaustion fails and immutable preflight absence stays immediate", async () => {
  let waits = 0;
  await fixture(() => assert.rejects(waitForRegistry(() => architecture("junsungkang/fixture-absent", "build", "arm64", revision, "0.2.0"),
    { attempts: 3, intervalMs: 0, wait: async () => waits++ }), /Missing image manifest/), { missing: { root: 3 } });
  assert.equal(waits, 2);
  await fixture(async () => assert.equal(await manifest("junsungkang/fixture-preflight", "build"), null), { missing: { root: 1 } });
});
test("post-push waiting never retries auth, integrity or source validation failures", async () => {
  let waits = 0;
  const check = () => assert.rejects(waitForRegistry(() => architecture("junsungkang/fixture-fail-closed", "build", "arm64", revision, "0.2.0"),
    { attempts: 3, intervalMs: 0, wait: async () => waits++ }));
  for (const options of [{ status: 403 }, { corrupt: true }, { wrongDescriptor: true }, { labels: { "org.opencontainers.image.revision": "b".repeat(40) } }]) await fixture(check, options);
  assert.equal(waits, 0);
});
test("post-write latest verification waits for the intended exact index digest", async () => {
  const original = globalThis.fetch, old = JSON.stringify({ manifests: [], previous: true }), current = JSON.stringify({ manifests: [] });
  let reads = 0, waits = 0;
  globalThis.fetch = async url => {
    if (String(url).includes("/token?")) return Response.json({ token: "synthetic-public-pull-token" });
    const body = ++reads < 3 ? old : current;
    return new Response(body, { headers: { "docker-content-digest": digest(body) } });
  };
  try {
    const value = await visibleManifest("junsungkang/fixture-latest", "latest", digest(current), { attempts: 3, intervalMs: 0, wait: async () => waits++ });
    assert.equal(value.digest, digest(current)); assert.equal(waits, 2);
  } finally { globalThis.fetch = original; }
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
