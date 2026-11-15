import { promises as fs } from "node:fs";

import crypto from "node:crypto";
import { maildirImportStatePath } from "../../bootstrap/storage-config.mjs";

export async function readMaildirImportState() {
  try {
    const raw = await fs.readFile(maildirImportStatePath, "utf8");
    const values = JSON.parse(raw);
    return new Set(
      Array.isArray(values)
        ? values.filter((value) => typeof value === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}
export async function writeMaildirImportState(values) {
  const temporary = `${maildirImportStatePath}.${crypto.randomUUID()}.tmp`;
  const existing = await fs.stat(maildirImportStatePath).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (
    existing &&
    (existing.uid !== process.getuid?.() || existing.gid !== process.getgid?.())
  ) {
    throw new Error("Import ledger ownership mismatch");
  }
  try {
    await fs.writeFile(temporary, JSON.stringify([...values].sort(), null, 2), {
      flag: "wx",
      mode: existing ? existing.mode & 0o777 : 0o644,
    });
    await fs.rename(temporary, maildirImportStatePath);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
