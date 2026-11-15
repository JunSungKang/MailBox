import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  dataDir,
  dropInboxDir,
  dropProcessedDir,
  dropFailedDir,
} from "../bootstrap/storage-config.mjs";

import { auditError, auditInfo } from "../shared/audit-logger.mjs";
import { textToHtml } from "../shared/text.mjs";
import { parseMailFile } from "../infrastructure/mime/parser-adapter.mjs";

import { messageDir } from "../infrastructure/filesystem/message-repository.mjs";
import { addressText, headerText, isBounceSource } from "./bounce-policy.mjs";
export async function ingestInboxDropBatch() {
  const entries = await fs.readdir(dropInboxDir, { withFileTypes: true });
  const files = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".eml"),
  );
  if (files.length > 0) {
    auditInfo("mail.import.drop.start", {
      sourceCount: files.length,
    });
  }
  for (const file of files) {
    const sourcePath = path.join(dropInboxDir, file.name);
    let staging;
    let unfinished;
    try {
      const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const stagingPath = path.join(dataDir, "tmp", `import-${id}`);
      await fs.mkdir(stagingPath);
      staging = stagingPath;
      let parsed;
      try {
        parsed = await parseMailFile(
          sourcePath,
          path.join(staging, "attachments"),
        );
      } catch (error) {
        await fs.rm(staging, { recursive: true, force: true });
        throw error;
      }
      const targetBox = isBounceSource(
        addressText(parsed.from),
        parsed.subject || "",
        headerText(parsed.headers.get("auto-submitted")),
        headerText(parsed.headers.get("content-type")),
      )
        ? "bounced"
        : "inbox";
      const dir = messageDir(targetBox, id);
      await fs.rename(staging, dir);
      staging = undefined;
      unfinished = dir;
      const attachments = parsed.attachments;
      const meta = {
        id,
        box: targetBox,
        from: addressText(parsed.from),
        to: addressText(parsed.to) ? [addressText(parsed.to)] : [],
        subject: parsed.subject || "",
        date: parsed.date?.toISOString() || new Date().toISOString(),
        attachments,
      };
      const bodyText = parsed.text || "";
      await Promise.all([
        fs.writeFile(
          path.join(dir, "meta.json"),
          JSON.stringify(meta, null, 2),
        ),
        fs.writeFile(path.join(dir, "body.txt"), bodyText),
        fs.writeFile(path.join(dir, "body.html"), textToHtml(bodyText)),
      ]);
      unfinished = undefined;
      await fs
        .rename(sourcePath, path.join(dropProcessedDir, file.name))
        .catch(async () => {
          await fs.rm(sourcePath, { force: true });
        });
      auditInfo("mail.import.drop.message.success", {
        sourceFile: file.name,
        messageId: id,
        box: targetBox,
        attachmentCount: attachments.length,
      });
    } catch (error) {
      if (staging || unfinished)
        await fs.rm(staging || unfinished, { recursive: true, force: true });
      await fs
        .rename(sourcePath, path.join(dropFailedDir, file.name))
        .catch(() => {});
      auditError("mail.import.drop.message.failure", {
        sourceFile: file.name,
        error,
      });
    }
  }
}
