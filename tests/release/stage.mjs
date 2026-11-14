import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { modules, imageName, architecture, assertCurrentMain } from "./registry.mjs";
const root = fs.realpathSync(process.cwd()), directory = fs.realpathSync(process.env.CHECK_DIR);
assert(directory.startsWith(root + path.sep));
await assertCurrentMain();
const arch = process.env.EXPECTED_ARCHITECTURE; assert(["amd64", "arm64"].includes(arch)); assert.match(process.env.GITHUB_RUN_ID || "", /^\d+$/);
const checked = JSON.parse(fs.readFileSync(directory + "/reports/final-image-verification.json"));
const images = JSON.parse(fs.readFileSync(directory + "/reports/images.json")); assert.equal(images.revision, process.env.GITHUB_SHA);
const staged = [];
for (const module of modules) {
  const image = images.images.find(x => x.module === module), scan = checked[module];
  assert.equal(scan.imageId, image.imageId); assert(!scan.counts.HIGH && !scan.counts.CRITICAL);
  const current = JSON.parse(execFileSync("docker", ["image", "inspect", image.image], { encoding: "utf8" }))[0];
  assert.equal(current.Id, image.imageId); assert.equal(current.Architecture, arch);
  const name = imageName(module), tag = `build-${process.env.GITHUB_RUN_ID}-${arch}`, target = `ghcr.io/${name}:${tag}`;
  await assertCurrentMain();
  execFileSync("docker", ["image", "tag", image.imageId, target], { stdio: "pipe" });
  execFileSync("docker", ["image", "push", target], { stdio: "inherit" });
  staged.push({ module, target, ...await architecture(name, tag, arch, process.env.GITHUB_SHA, images.version) });
}
fs.writeFileSync(directory + "/reports/staged.json", JSON.stringify({ status: "success", revision: images.revision, images: staged }, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ time: new Date().toISOString(), level: "INFO", event: "release.images.staged", actor: process.env.GITHUB_ACTOR, status: "success", architecture: arch, count: staged.length }));
