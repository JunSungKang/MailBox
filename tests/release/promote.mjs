import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { modules, imageName, manifest, architecture, assertCurrentMain } from "./registry.mjs";
import { planImmutableTags, assemblyArguments } from "./promotion.mjs";
const root = fs.realpathSync(process.cwd()), directory = fs.realpathSync(process.env.CHECK_DIR);
assert(directory.startsWith(root + path.sep)); await assertCurrentMain();
const version = fs.readFileSync(root + "/VERSION", "utf8").trim(), sha = process.env.GITHUB_SHA;
assert.match(version, /^\d+\.\d+\.\d+$/); assert.match(process.env.GITHUB_RUN_ID || "", /^\d+$/);
const expected = {};
for (const module of modules) {
  const name = imageName(module); expected[module] = {};
  for (const arch of ["amd64", "arm64"]) expected[module][arch] = await architecture(name, `build-${process.env.GITHUB_RUN_ID}-${arch}`, arch, sha, version);
  const tags = ["sha-" + sha, "v" + version], existing = {};
  for (const tag of tags) {
    const old = await manifest(name, tag);
    if (old) {
      existing[tag] = old;
      assert.equal(old.data.manifests?.filter(x => x.platform?.os === "linux").length, 2);
      for (const arch of ["amd64", "arm64"]) assert.equal((await architecture(name, tag, arch, sha, version)).digest, expected[module][arch].digest, "Refuse immutable tag replacement");
    }
  }
  expected[module].plan = planImmutableTags(tags, existing);
}
const images = [];
for (const module of modules) {
  await assertCurrentMain(); const name = imageName(module), full = "ghcr.io/" + name;
  const plan = expected[module].plan;
  for (const tag of plan.missing) assert.equal(await manifest(name, tag), null, "Immutable tag appeared during publication");
  if (plan.missing.length) {
    const sources = plan.existingDigest ? [full + "@" + plan.existingDigest] :
      [full + ":build-" + process.env.GITHUB_RUN_ID + "-amd64", full + ":build-" + process.env.GITHUB_RUN_ID + "-arm64"];
    execFileSync("docker", assemblyArguments(full, plan.missing, sources), { stdio: "inherit" });
  }
  const combined = await manifest(name, "sha-" + sha); assert(combined.data.manifests);
  for (const arch of ["amd64", "arm64"]) assert.equal((await architecture(name, "sha-" + sha, arch, sha, version)).digest, expected[module][arch].digest);
  assert.equal((await manifest(name, "v" + version)).digest, combined.digest);
  for (const [tag, digest] of Object.entries(plan.preserved)) assert.equal((await manifest(name, tag)).digest, digest, "Existing immutable index changed");
  images.push({ image: full, digest: combined.digest, version, revision: sha, architectures: ["amd64", "arm64"] });
}
// All three immutable multi-arch images are verified before moving any latest tag.
for (const image of images) {
  await assertCurrentMain();
  execFileSync("docker", ["buildx", "imagetools", "create", "--prefer-index=true", "--tag", image.image + ":latest", image.image + "@" + image.digest], { stdio: "inherit" });
  assert.equal((await manifest(image.image.slice("ghcr.io/".length), "latest")).digest, image.digest);
}
fs.mkdirSync(directory + "/reports", { recursive: true, mode: 0o700 });
fs.writeFileSync(directory + "/reports/published.json", JSON.stringify({ status: "success", revision: sha, version, images }, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ time: new Date().toISOString(), level: "INFO", event: "release.images.published", actor: process.env.GITHUB_ACTOR, status: "success", count: images.length, version, revision: sha }));
