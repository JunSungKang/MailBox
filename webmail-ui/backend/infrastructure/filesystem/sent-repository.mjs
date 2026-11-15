import { promises as fs } from "node:fs";
import path from "node:path";
import { safeSegment } from "../../shared/safe-path.mjs";
import { textToHtml } from "../../shared/text.mjs";
export function createSentRepository(root, io = fs) {
  return {
    async stage(id, uploaded) {
      const directory = path.join(root, "sent", safeSegment(id), "attachments");
      await io.mkdir(directory, { recursive: true });
      const attachments = [];
      for (const item of uploaded) {
        const target = path.join(directory, safeSegment(item.storedName));
        await io.rename(item.tempPath, target);
        const { tempPath, ...meta } = item;
        attachments.push({ ...meta, path: target });
      }
      return attachments;
    },
    async persist(meta, text) {
      const directory = path.join(root, "sent", safeSegment(meta.id));
      await Promise.all([
        io.writeFile(
          path.join(directory, "meta.json"),
          JSON.stringify(meta, null, 2),
        ),
        io.writeFile(path.join(directory, "body.txt"), text),
        io.writeFile(path.join(directory, "body.html"), textToHtml(text)),
      ]);
    },
  };
}
