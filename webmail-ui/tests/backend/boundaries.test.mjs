import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const walk = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
test("client entry graphs exclude server bridges, storage and SMTP implementations", () => {
  const visited = new Set();
  function inspect(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = fs.readFileSync(file, "utf8");
    assert(!file.includes("/backend/") && !file.includes("/src/server/"), file);
    for (const match of source.matchAll(
      /import\s+(?!type\b)[\s\S]*?from\s*["']([^"']+)["']/g,
    )) {
      const spec = match[1];
      assert(
        !/^(node:|fs$|nodemailer|mailparser|busboy|server-only)/.test(spec),
        file + ":" + spec,
      );
      if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
      const base = spec.startsWith("@/")
        ? path.join(root, "src", spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      const resolved = [base, base + ".tsx", base + ".ts", base + ".mjs"].find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
      assert(resolved, "Missing client import " + spec);
      inspect(resolved);
    }
  }
  for (const file of walk(root + "/src").filter((file) => /\.tsx?$/.test(file)))
    if (/^['"]use client['"];/.test(fs.readFileSync(file, "utf8")))
      inspect(file);
  assert(visited.size > 3);
});
