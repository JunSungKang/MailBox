import { promises as fs } from "node:fs";
import path from "node:path";

import {
  maildirImportDir,
  maildirImportParentDir,
} from "../bootstrap/storage-config.mjs";
import { boundedMap } from "../shared/bounded-map.mjs";

function maildirKeyPrefix(root) {
  return root.replaceAll(path.sep, "/").replace(/[^A-Za-z0-9._/-]+/g, "_");
}
async function listMaildirSources() {
  const roots = new Set([maildirImportDir]);
  if (maildirImportParentDir) {
    const entries = await fs
      .readdir(maildirImportParentDir, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      roots.add(path.join(maildirImportParentDir, entry.name, "Maildir"));
    }
  }
  const sources = [];
  const seenRoots = new Set();
  for (const root of roots) {
    const rootStat = await fs.stat(root).catch(() => null);
    const newStat = await fs.stat(path.join(root, "new")).catch(() => null);
    if (rootStat && newStat?.isDirectory()) {
      const rootKey = `${rootStat.dev}:${rootStat.ino}`;
      if (seenRoots.has(rootKey)) continue;
      seenRoots.add(rootKey);
      sources.push({ root, keyPrefix: maildirKeyPrefix(root) });
    }
  }
  return sources;
}
export async function listMaildirFiles() {
  const sources = await listMaildirSources();
  const sourceFiles = await boundedMap(sources, 4, async (source) => {
    const folders = await Promise.all(
      ["new", "cur"].map(async (folder) => {
        const dir = path.join(source.root, folder);
        const entries = await fs
          .readdir(dir, { withFileTypes: true })
          .catch(() => []);
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => {
            const sourcePath = path.join(dir, entry.name);
            const relativePath = path
              .relative(source.root, sourcePath)
              .replaceAll(path.sep, "/");
            return {
              sourcePath,
              importKey: `${source.keyPrefix}:${relativePath}`,
            };
          });
      }),
    );
    return folders.flat();
  });
  return sourceFiles.flat();
}
