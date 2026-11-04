import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const source = "/accounts/virtual-mailbox-accounts";
const target = "/var/lib/mailbox-maps/virtual-mailbox-accounts";
const entry = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\s+[A-Za-z0-9._-]+\/Maildir\/$/;
let previous;
const log = (level, event) => console.log(JSON.stringify({
  time: new Date().toISOString(), level, event, actor: "mapbuilder"
}));

function refresh() {
  try {
    const raw = fs.readFileSync(source);
    const checksum = crypto.createHash("sha256").update(raw).digest("hex");
    if (checksum === previous) return;
    const lines = raw.toString().split(/\r?\n/).map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    if (!lines.length || !lines.every((line) => entry.test(line))) throw new Error("Invalid map");
    fs.writeFileSync(`${target}.new`, [...new Set(lines)].sort().join("\n") + "\n", { mode: 0o644 });
    execFileSync("postmap", [`lmdb:${target}.new`], { stdio: "pipe" });
    fs.chmodSync(`${target}.new.lmdb`, 0o644);
    fs.renameSync(`${target}.new.lmdb`, `${target}.lmdb`);
    fs.renameSync(`${target}.new`, target);
    previous = checksum;
    log("INFO", "mail.account_map.refresh.success");
  } catch {
    log("ERROR", "mail.account_map.refresh.failure");
    if (process.argv.includes("--once")) process.exitCode = 1;
  }
}

refresh();
// Postfix observes LMDB replacement itself. This worker cannot signal root.
if (!process.argv.includes("--once")) setInterval(refresh, 2000);
