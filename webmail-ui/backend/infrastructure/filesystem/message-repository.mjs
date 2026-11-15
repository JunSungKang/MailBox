import { promises as fs } from "node:fs";
import path from "node:path";

import {
  dataDir,
  mailRoot,
  dropInboxDir,
  dropProcessedDir,
  dropFailedDir,
  boxes,
} from "../../bootstrap/storage-config.mjs";
import { boundedMap } from "../../shared/bounded-map.mjs";

import {
  safeSegment,
  safeSegment as assertSafeSegment,
} from "../../shared/safe-path.mjs";
export function isMailBox(value) {
  return value === "inbox" || value === "sent" || value === "bounced";
}
export { safeSegment as assertSafeSegment };
export function boxDir(box) {
  return path.join(mailRoot, box);
}
export function messageDir(box, id) {
  return path.join(boxDir(box), assertSafeSegment(id));
}
export function attachmentPath(box, id, attachmentId) {
  return path.join(
    messageDir(box, id),
    "attachments",
    assertSafeSegment(attachmentId),
  );
}
export async function ensureMailDirs() {
  await Promise.all([
    ...boxes.map((box) => fs.mkdir(boxDir(box), { recursive: true })),
    fs.mkdir(path.join(dataDir, "tmp"), { recursive: true }),
    fs.mkdir(dropInboxDir, { recursive: true }),
    fs.mkdir(dropProcessedDir, { recursive: true }),
    fs.mkdir(dropFailedDir, { recursive: true }),
  ]);
}
export async function listStoredMessages(box) {
  const entries = await fs.readdir(boxDir(box), { withFileTypes: true });
  const messages = await boundedMap(
    entries.filter((entry) => entry.isDirectory()),
    32,
    async (entry) => {
      try {
        const raw = await fs.readFile(
          path.join(boxDir(box), entry.name, "meta.json"),
          "utf8",
        );
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
  );
  return messages
    .filter((message) => message !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
export async function readMessage(box, id) {
  await ensureMailDirs();
  try {
    const dir = messageDir(box, id);
    const [metaRaw, bodyText, bodyHtml] = await Promise.all([
      fs.readFile(path.join(dir, "meta.json"), "utf8"),
      fs.readFile(path.join(dir, "body.txt"), "utf8").catch(() => ""),
      fs.readFile(path.join(dir, "body.html"), "utf8").catch(() => ""),
    ]);
    const meta = JSON.parse(metaRaw);
    return { ...meta, bodyText, bodyHtml };
  } catch {
    return null;
  }
}
