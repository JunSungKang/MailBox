import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = fs.realpathSync(process.cwd());
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
assert.match(version, /^\d+\.\d+\.\d+$/);
const license = fs.readFileSync(path.join(root, "LICENSE"));
assert.equal(crypto.createHash("sha256").update(license).digest("hex"), "d8a6cc31abc16b6748c7a21f21611f5a1ec33f67d22ca23d7da1c19b95496bee");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "webmail-ui/package.json")));
const lock = JSON.parse(fs.readFileSync(path.join(root, "webmail-ui/package-lock.json")));
assert.equal(pkg.version, version); assert.equal(lock.version, version); assert.equal(lock.packages[""].version, version);
assert.equal(pkg.license, "AGPL-3.0-only"); assert.equal(lock.packages[""].license, pkg.license);
assert.deepEqual(fs.readFileSync(path.join(root, ".dockerignore"), "utf8").trim().split("\n"), ["**", "!LICENSE", "!NOTICE"]);
const images = [];
if (process.argv.includes("--images")) {
  const directory = fs.realpathSync(path.resolve(process.env.CHECK_DIR || ""));
  assert(directory.startsWith(root + path.sep)); fs.mkdirSync(directory + "/reports", { recursive: true, mode: 0o700 });
  const tag = process.env.TAG; assert.match(tag || "", /^[a-z0-9][a-z0-9_.-]+$/);
  const revision = process.env.SOURCE_REVISION || "unknown";
  if (process.env.GITHUB_ACTIONS === "true") assert.match(revision, /^[a-f0-9]{40}$/);
  const docker = args => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  for (const module of ["smtp-receiver", "imap-mailbox", "webmail-ui"]) {
    const image = `mailbox-${module}:${tag}`;
    const value = JSON.parse(docker(["image", "inspect", image]))[0];
    const labels = value.Config.Labels;
    assert.equal(labels["org.opencontainers.image.licenses"], pkg.license);
    assert.equal(labels["org.opencontainers.image.source"], "https://github.com/JunSungKang/MailBox");
    assert.equal(labels["org.opencontainers.image.version"], version);
    assert.equal(labels["org.opencontainers.image.revision"], revision);
    const embedded = docker(["run", "--rm", "--read-only", "--network", "none", "--entrypoint", "cat", image, "/usr/share/doc/mailbox/LICENSE"]);
    assert.equal(crypto.createHash("sha256").update(embedded).digest("hex"), crypto.createHash("sha256").update(license).digest("hex"));
    const profile = docker(["run", "--rm", "--read-only", "--tmpfs", "/tmp:rw,mode=1777", "--network", "none", "--entrypoint", "sh", image, "-ec",
      '. /etc/os-release; test "$ID" = ubuntu; test "$VERSION_ID" = 26.04; ' +
      (module === "imap-mailbox" ? "dovecot --version | grep '^2.4.'; doveadm pw -l | grep ARGON2ID" : "node -e 'if(process.versions.node.split(\".\")[0]!==\"24\"||typeof require(\"node:crypto\").argon2!==\"function\")process.exit(1);console.log(process.version)'" )]);
    images.push({ module, image, imageId: value.Id, architecture: value.Architecture, labels, profile: profile.trim() });
  }
  fs.writeFileSync(directory + "/reports/images.json", JSON.stringify({ status: "success", version, revision, images }, null, 2) + "\n", { mode: 0o600 });
}
console.log(JSON.stringify({ time: new Date().toISOString(), level: "INFO", event: "release.metadata.validated", status: "success", version, images: images.length }));
