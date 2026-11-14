import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const root = fs.realpathSync(process.cwd()), directory = fs.realpathSync(process.env.CHECK_DIR);
assert(directory.startsWith(root + path.sep)); assert.match(process.env.TAG || "", /^[a-z0-9][a-z0-9_.-]+$/);
fs.mkdirSync(directory + "/tmp", { recursive: true, mode: 0o777 }); fs.chmodSync(directory + "/tmp", 0o777);
fs.mkdirSync(directory + "/reports", { recursive: true, mode: 0o700 });
const tests = fs.readdirSync(root + "/webmail-ui").filter(x => x.endsWith(".test.mjs")).sort();
const args = ["run", "--rm", "--read-only", "--network", "none", "--user", "5000:5000", "--entrypoint", "node", "--env", "TMPDIR=/scratch", "--env", "RANDFILE=/scratch/.rnd", "--env", "MAILBOX_TEST_TMP=/scratch",
  "--mount", `type=bind,src=${directory}/tmp,dst=/scratch`, "--mount", `type=bind,src=${root}/webmail-ui/src,dst=/app/src,readonly`];
for (const test of tests) args.push("--mount", `type=bind,src=${root}/webmail-ui/${test},dst=/app/${test},readonly`);
args.push(`mailbox-webmail-ui:${process.env.TAG}`, "--test", ...tests);
const fd = fs.openSync(directory + "/reports/unit-tests.log", "w", 0o600);
try { execFileSync("docker", args, { stdio: ["ignore", fd, fd] }); } finally { fs.closeSync(fd); }
fs.rmSync(directory + "/tmp/.rnd", { force: true });
console.log(JSON.stringify({ time: new Date().toISOString(), level: "INFO", event: "release.unit.success", status: "success", files: tests.length }));
