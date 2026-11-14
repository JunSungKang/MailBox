import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const root = fs.realpathSync(process.cwd()), directory = fs.realpathSync(process.env.CHECK_DIR);
assert(directory.startsWith(root + path.sep));
const metadata = JSON.parse(fs.readFileSync(directory + "/reports/images.json")); assert.equal(metadata.status, "success");
for (const dir of ["images", "tmp", "cache"]) fs.mkdirSync(directory + "/" + dir, { recursive: true, mode: 0o700 });
const candidates = {};
for (const image of metadata.images) {
  const archive = directory + "/images/" + image.module + ".tar";
  execFileSync("docker", ["image", "save", "--output", archive, image.image], { stdio: "pipe" });
  const log = fs.openSync(directory + "/reports/scan-" + image.module + ".log", "w", 0o600);
  try {
    execFileSync("docker", ["run", "--rm", "--mount", `type=bind,src=${directory},dst=/work`, "--env", "TMPDIR=/work/tmp",
      "aquasec/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb", "image", "--cache-dir", "/work/cache", "--scanners", "vuln", "--skip-java-db-update",
      "--input", "/work/images/" + image.module + ".tar", "--format", "json", "--output", "/work/reports/" + image.module + ".trivy.json", "--timeout", "15m"], { stdio: ["ignore", log, log] });
  } finally { fs.closeSync(log); }
  candidates[image.module] = { tag: image.image, imageId: image.imageId };
}
fs.writeFileSync(directory + "/reports/candidate-images.json", JSON.stringify(candidates, null, 2) + "\n", { mode: 0o600 });
execFileSync("node", [root + "/tests/platform/check-images.mjs", directory], { stdio: "inherit" });
fs.copyFileSync(directory + "/cache/db/metadata.json", directory + "/reports/trivy-db-metadata.json");
