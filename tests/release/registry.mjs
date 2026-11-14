import crypto from "node:crypto";
import assert from "node:assert/strict";
export const modules = ["smtp-receiver", "imap-mailbox", "webmail-ui"];
export const repository = "JunSungKang/MailBox";
export const imageName = module => "junsungkang/mail-server-" + module;
const accept = "application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json";
const tokens = new Map();
async function token(name) {
  if (!tokens.has(name)) {
    const r = await fetch("https://ghcr.io/token?service=ghcr.io&scope=" + encodeURIComponent("repository:" + name + ":pull"));
    if (!r.ok) throw Error("Public registry token request failed: " + r.status);
    tokens.set(name, (await r.json()).token);
  }
  return tokens.get(name);
}
export async function manifest(name, ref) {
  const r = await fetch(`https://ghcr.io/v2/${name}/manifests/${ref}`, { headers: { Authorization: "Bearer " + await token(name), Accept: accept } });
  if (r.status === 404) return null;
  if (!r.ok) throw Error("Public manifest request failed: " + r.status);
  const bytes = Buffer.from(await r.arrayBuffer());
  const digest = "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(r.headers.get("docker-content-digest"), digest);
  return { digest, data: JSON.parse(bytes) };
}
export async function architecture(name, ref, arch, revision, version) {
  const root = await manifest(name, ref); assert(root, "Missing image manifest");
  let image = root;
  if (image.data.manifests) {
    const entries = image.data.manifests.filter(x => x.platform?.os === "linux" && x.platform?.architecture === arch);
    assert.equal(entries.length, 1); image = await manifest(name, entries[0].digest);
  }
  const digest = image.data.config.digest;
  const r = await fetch(`https://ghcr.io/v2/${name}/blobs/${digest}`, { headers: { Authorization: "Bearer " + await token(name) } });
  if (!r.ok) throw Error("Public image config request failed: " + r.status);
  const bytes = Buffer.from(await r.arrayBuffer()); assert.equal("sha256:" + crypto.createHash("sha256").update(bytes).digest("hex"), digest);
  const config = JSON.parse(bytes), labels = config.config.Labels;
  assert.equal(config.architecture, arch); assert.equal(config.os, "linux");
  assert.equal(labels["org.opencontainers.image.source"], "https://github.com/" + repository);
  assert.equal(labels["org.opencontainers.image.licenses"], "AGPL-3.0-only");
  assert.equal(labels["org.opencontainers.image.revision"], revision); assert.equal(labels["org.opencontainers.image.version"], version);
  return { digest: image.digest, configDigest: digest, architecture: arch, labels };
}
export async function assertCurrentMain() {
  assert.equal(process.env.GITHUB_ACTIONS, "true"); assert.equal(process.env.GITHUB_REPOSITORY, repository);
  assert.equal(process.env.GITHUB_REF, "refs/heads/main"); assert.match(process.env.GITHUB_SHA || "", /^[a-f0-9]{40}$/);
  const r = await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/main`, { headers: { Authorization: "Bearer " + process.env.GH_TOKEN, Accept: "application/vnd.github+json" } });
  if (!r.ok) throw Error("Current main verification failed: " + r.status);
  assert.equal((await r.json()).object.sha, process.env.GITHUB_SHA, "Refuse stale workflow publication");
}
