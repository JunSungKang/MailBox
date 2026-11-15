import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "../bootstrap/storage-config.mjs";

import { auditError, auditInfo, auditWarn } from "../shared/audit-logger.mjs";
import { textToHtml } from "../shared/text.mjs";
import { parseMailFile } from "../infrastructure/mime/parser-adapter.mjs";
import { canonicalMaildirKey } from "../shared/maildir-identity.mjs";
import {
  boxDir,
  messageDir,
} from "../infrastructure/filesystem/message-repository.mjs";
import {
  addressText,
  headerText,
  isBounceSource,
  isBounceMeta,
} from "./bounce-policy.mjs";
import { listMaildirFiles } from "./maildir-source.mjs";
import {
  readMaildirImportState,
  writeMaildirImportState,
} from "../infrastructure/filesystem/import-ledger.mjs";
export async function ingestMaildirBatch() {
  const maildirFiles = await listMaildirFiles();
  if (maildirFiles.length === 0) return;
  const startedAt = Date.now();
  const imported = await readMaildirImportState();
  const knownIdentities = new Set([...imported].map(canonicalMaildirKey));
  let changed = false;
  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  auditInfo("mail.import.maildir.start", {
    sourceCount: maildirFiles.length,
  });
  for (const { sourcePath, importKey } of maildirFiles) {
    const identity = canonicalMaildirKey(importKey);
    if (knownIdentities.has(identity)) {
      if (!imported.has(importKey)) {
        // Keep old entries and add the current raw path for rollback readers.
        imported.add(importKey);
        changed = true;
        auditInfo("mail.import.maildir.alias.success", {
          actor: "system",
          method: "IMPORT",
          path: "maildir",
          status: "success",
          sourceIdentity: crypto
            .createHash("sha256")
            .update(identity)
            .digest("hex"),
        });
      }
      skippedCount += 1;
      continue;
    }
    let staging;
    let unfinished;
    try {
      const messageId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const stagingPath = path.join(dataDir, "tmp", `import-${messageId}`);
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
        addressText(parsed.from) ||
          headerText(parsed.headers.get("return-path")),
        parsed.subject || "",
        headerText(parsed.headers.get("auto-submitted")),
        headerText(parsed.headers.get("content-type")),
      )
        ? "bounced"
        : "inbox";
      const dir = messageDir(targetBox, messageId);
      await fs.rename(staging, dir);
      staging = undefined;
      unfinished = dir;
      const attachments = parsed.attachments;
      const toText =
        addressText(parsed.to) ||
        headerText(parsed.headers.get("delivered-to")) ||
        headerText(parsed.headers.get("x-original-to"));
      const bodyText = parsed.text || "";
      const bodyHtml =
        typeof parsed.html === "string" ? parsed.html : textToHtml(bodyText);
      const meta = {
        id: messageId,
        box: targetBox,
        from:
          addressText(parsed.from) ||
          headerText(parsed.headers.get("return-path")),
        to: toText ? [toText] : [],
        subject: parsed.subject || "",
        date: parsed.date?.toISOString() || new Date().toISOString(),
        attachments,
      };
      await Promise.all([
        fs.writeFile(
          path.join(dir, "meta.json"),
          JSON.stringify(meta, null, 2),
        ),
        fs.writeFile(path.join(dir, "body.txt"), bodyText),
        fs.writeFile(path.join(dir, "body.html"), bodyHtml),
      ]);
      unfinished = undefined;
      imported.add(importKey);
      knownIdentities.add(identity);
      changed = true;
      importedCount += 1;
      auditInfo("mail.import.maildir.message.success", {
        sourcePath,
        importKey,
        messageId,
        box: targetBox,
        attachmentCount: attachments.length,
      });
    } catch (error) {
      if (staging || unfinished)
        await fs.rm(staging || unfinished, { recursive: true, force: true });
      failedCount += 1;
      auditError("mail.import.maildir.message.failure", {
        sourcePath,
        importKey,
        error,
      });
      continue;
    }
  }
  if (changed) {
    await writeMaildirImportState(imported);
  }
  auditInfo("mail.import.maildir.finish", {
    sourceCount: maildirFiles.length,
    importedCount,
    skippedCount,
    failedCount,
    durationMs: Date.now() - startedAt,
  });
}
export async function copyExistingBounces() {
  const entries = await fs
    .readdir(boxDir("inbox"), { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourceDir = messageDir("inbox", entry.name);
    const targetDir = messageDir("bounced", entry.name);
    try {
      await fs.access(path.join(targetDir, "meta.json"));
      continue;
    } catch {
      // Copy below when a matching inbox message has not already been promoted.
    }
    try {
      const raw = await fs.readFile(path.join(sourceDir, "meta.json"), "utf8");
      const meta = JSON.parse(raw);
      if (!isBounceMeta(meta)) continue;
      await fs.cp(sourceDir, targetDir, { recursive: true });
      await fs.writeFile(
        path.join(targetDir, "meta.json"),
        JSON.stringify({ ...meta, box: "bounced" }, null, 2),
      );
      auditInfo("mail.bounce.copy.success", {
        messageId: entry.name,
        sourceBox: "inbox",
        targetBox: "bounced",
      });
    } catch {
      auditWarn("mail.bounce.copy.failure", {
        messageId: entry.name,
      });
      continue;
    }
  }
}
