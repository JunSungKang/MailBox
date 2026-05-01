import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { simpleParser } from "mailparser";
import { textToHtml } from "./text";

export type MailBox = "inbox" | "sent" | "bounced";

export type AttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  storedName: string;
};

export type DeliveryMeta = {
  attempted: boolean;
  ok: boolean;
  detail?: string;
};

export type MailMeta = {
  id: string;
  box: MailBox;
  from: string;
  to: string[];
  subject: string;
  date: string;
  attachments: AttachmentMeta[];
  delivery?: DeliveryMeta;
};

export type MailMessage = MailMeta & {
  bodyText: string;
  bodyHtml: string;
};

export const boxLabels: Record<MailBox, string> = {
  inbox: "받은 메일함",
  sent: "보낸 메일함",
  bounced: "반송된 메일함"
};

export const dataDir = process.env.MAIL_DATA_DIR || path.join(process.cwd(), "data");
export const mailRoot = path.join(dataDir, "mail");
const dropInboxDir = path.join(dataDir, "drop", "inbox");
const dropProcessedDir = path.join(dataDir, "drop", "processed");
const dropFailedDir = path.join(dataDir, "drop", "failed");
const maildirImportDir = process.env.MAILDIR_IMPORT_DIR || "/app/import/Maildir";
const maildirImportParentDir = process.env.MAILDIR_IMPORT_PARENT_DIR || "";
const maildirImportStatePath = path.join(dataDir, "maildir-imported.json");

const boxes: MailBox[] = ["inbox", "sent", "bounced"];

export function isMailBox(value: string): value is MailBox {
  return value === "inbox" || value === "sent" || value === "bounced";
}

export function assertSafeSegment(value: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error("Invalid path segment");
  }
  return value;
}

export function boxDir(box: MailBox): string {
  return path.join(mailRoot, box);
}

export function messageDir(box: MailBox, id: string): string {
  return path.join(boxDir(box), assertSafeSegment(id));
}

export function attachmentPath(box: MailBox, id: string, attachmentId: string): string {
  return path.join(messageDir(box, id), "attachments", assertSafeSegment(attachmentId));
}

export async function ensureMailDirs(): Promise<void> {
  await Promise.all(
    [
      ...boxes.map((box) => fs.mkdir(boxDir(box), { recursive: true })),
      fs.mkdir(path.join(dataDir, "tmp"), { recursive: true }),
      fs.mkdir(dropInboxDir, { recursive: true }),
      fs.mkdir(dropProcessedDir, { recursive: true }),
      fs.mkdir(dropFailedDir, { recursive: true })
    ]
  );
}

export async function listMessages(box: MailBox): Promise<MailMeta[]> {
  await ensureMailDirs();
  if (box === "inbox" || box === "bounced") {
    await ingestMaildir();
    await ingestInboxDrop();
  }
  if (box === "bounced") {
    await copyExistingBounces();
  }

  const entries = await fs.readdir(boxDir(box), { withFileTypes: true });
  const messages = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const raw = await fs.readFile(path.join(boxDir(box), entry.name, "meta.json"), "utf8");
          return JSON.parse(raw) as MailMeta;
        } catch {
          return null;
        }
      })
  );

  return messages
    .filter((message): message is MailMeta => message !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function readMessage(box: MailBox, id: string): Promise<MailMessage | null> {
  await ensureMailDirs();
  try {
    const dir = messageDir(box, id);
    const [metaRaw, bodyText, bodyHtml] = await Promise.all([
      fs.readFile(path.join(dir, "meta.json"), "utf8"),
      fs.readFile(path.join(dir, "body.txt"), "utf8").catch(() => ""),
      fs.readFile(path.join(dir, "body.html"), "utf8").catch(() => "")
    ]);
    const meta = JSON.parse(metaRaw) as MailMeta;
    return { ...meta, bodyText, bodyHtml };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function addressText(value: { text?: string } | { text?: string }[] | undefined): string {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value.map((item) => item.text || "").filter(Boolean).join(", ");
  }
  return value.text || "";
}

function headerText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(headerText).filter(Boolean).join(", ");
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  return String(value);
}

function isBounceSource(from: string, subject: string, autoSubmitted: string, contentType: string): boolean {
  const sourceText = `${from}\n${subject}\n${autoSubmitted}\n${contentType}`.toLowerCase();
  return (
    sourceText.includes("mailer-daemon") ||
    sourceText.includes("delivery status") ||
    sourceText.includes("delivery failure") ||
    sourceText.includes("undelivered mail") ||
    sourceText.includes("multipart/report") ||
    sourceText.includes("auto-replied")
  );
}

function isBounceMeta(meta: MailMeta): boolean {
  return isBounceSource(
    meta.from,
    meta.subject,
    "",
    meta.delivery && !meta.delivery.ok ? "delivery failure" : ""
  );
}

async function readMaildirImportState(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(maildirImportStatePath, "utf8");
    const values = JSON.parse(raw);
    return new Set(Array.isArray(values) ? values.filter((value) => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

async function writeMaildirImportState(values: Set<string>): Promise<void> {
  await fs.writeFile(maildirImportStatePath, JSON.stringify([...values].sort(), null, 2));
}

type MaildirSource = {
  root: string;
  keyPrefix: string;
};

type MaildirFile = {
  sourcePath: string;
  importKey: string;
};

function maildirKeyPrefix(root: string): string {
  return root.replaceAll(path.sep, "/").replace(/[^A-Za-z0-9._/-]+/g, "_");
}

async function listMaildirSources(): Promise<MaildirSource[]> {
  const roots = new Set<string>([maildirImportDir]);

  if (maildirImportParentDir) {
    const entries = await fs.readdir(maildirImportParentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      roots.add(path.join(maildirImportParentDir, entry.name, "Maildir"));
    }
  }

  const sources: MaildirSource[] = [];
  const seenRoots = new Set<string>();
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

async function listMaildirFiles(): Promise<MaildirFile[]> {
  const sources = await listMaildirSources();
  const sourceFiles = await Promise.all(
    sources.map(async (source) => {
      const folders = await Promise.all(
        ["new", "cur"].map(async (folder) => {
          const dir = path.join(source.root, folder);
          const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
          return entries
            .filter((entry) => entry.isFile())
            .map((entry) => {
              const sourcePath = path.join(dir, entry.name);
              const relativePath = path.relative(source.root, sourcePath).replaceAll(path.sep, "/");
              return {
                sourcePath,
                importKey: `${source.keyPrefix}:${relativePath}`
              };
            });
        })
      );
      return folders.flat();
    })
  );

  return sourceFiles.flat();
}

async function ingestMaildir(): Promise<void> {
  const maildirFiles = await listMaildirFiles();
  if (maildirFiles.length === 0) return;

  const imported = await readMaildirImportState();
  let changed = false;

  for (const { sourcePath, importKey } of maildirFiles) {
    if (imported.has(importKey)) continue;

    try {
      const raw = await fs.readFile(sourcePath);
      const parsed = await simpleParser(raw);
      const messageId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const targetBox: MailBox = isBounceSource(
        addressText(parsed.from) || headerText(parsed.headers.get("return-path")),
        parsed.subject || "",
        headerText(parsed.headers.get("auto-submitted")),
        headerText(parsed.headers.get("content-type"))
      )
        ? "bounced"
        : "inbox";
      const dir = messageDir(targetBox, messageId);
      const attachmentsDir = path.join(dir, "attachments");
      await fs.mkdir(attachmentsDir, { recursive: true });

      const attachments: AttachmentMeta[] = [];
      for (const attachment of parsed.attachments) {
        const attachmentId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
        await fs.writeFile(path.join(attachmentsDir, attachmentId), attachment.content);
        attachments.push({
          id: attachmentId,
          filename: attachment.filename || "attachment",
          contentType: attachment.contentType || "application/octet-stream",
          size: attachment.size || attachment.content.length,
          storedName: attachmentId
        });
      }

      const toText =
        addressText(parsed.to) ||
        headerText(parsed.headers.get("delivered-to")) ||
        headerText(parsed.headers.get("x-original-to"));
      const bodyText = parsed.text || "";
      const bodyHtml = typeof parsed.html === "string" ? parsed.html : textToHtml(bodyText);
      const meta: MailMeta = {
        id: messageId,
        box: targetBox,
        from: addressText(parsed.from) || headerText(parsed.headers.get("return-path")),
        to: toText ? [toText] : [],
        subject: parsed.subject || "",
        date: parsed.date?.toISOString() || new Date().toISOString(),
        attachments
      };

      await Promise.all([
        fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2)),
        fs.writeFile(path.join(dir, "body.txt"), bodyText),
        fs.writeFile(path.join(dir, "body.html"), bodyHtml)
      ]);

      imported.add(importKey);
      changed = true;
    } catch (error) {
      console.error(
        "Failed to import Maildir message",
        sourcePath,
        error instanceof Error ? error.message : error
      );
      continue;
    }
  }

  if (changed) {
    await writeMaildirImportState(imported);
  }
}

async function copyExistingBounces(): Promise<void> {
  const entries = await fs.readdir(boxDir("inbox"), { withFileTypes: true }).catch(() => []);
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
      const meta = JSON.parse(raw) as MailMeta;
      if (!isBounceMeta(meta)) continue;
      await fs.cp(sourceDir, targetDir, { recursive: true });
      await fs.writeFile(
        path.join(targetDir, "meta.json"),
        JSON.stringify({ ...meta, box: "bounced" satisfies MailBox }, null, 2)
      );
    } catch {
      continue;
    }
  }
}

async function ingestInboxDrop(): Promise<void> {
  const entries = await fs.readdir(dropInboxDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".eml"));

  for (const file of files) {
    const sourcePath = path.join(dropInboxDir, file.name);
    try {
      const raw = await fs.readFile(sourcePath);
      const parsed = await simpleParser(raw);
      const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const targetBox: MailBox = isBounceSource(
        addressText(parsed.from),
        parsed.subject || "",
        headerText(parsed.headers.get("auto-submitted")),
        headerText(parsed.headers.get("content-type"))
      )
        ? "bounced"
        : "inbox";
      const dir = messageDir(targetBox, id);
      const attachmentsDir = path.join(dir, "attachments");
      await fs.mkdir(attachmentsDir, { recursive: true });

      const attachments: AttachmentMeta[] = [];
      for (const attachment of parsed.attachments) {
        const attachmentId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
        await fs.writeFile(path.join(attachmentsDir, attachmentId), attachment.content);
        attachments.push({
          id: attachmentId,
          filename: attachment.filename || "attachment",
          contentType: attachment.contentType || "application/octet-stream",
          size: attachment.size || attachment.content.length,
          storedName: attachmentId
        });
      }

      const meta: MailMeta = {
        id,
        box: targetBox,
        from: addressText(parsed.from),
        to: addressText(parsed.to) ? [addressText(parsed.to)] : [],
        subject: parsed.subject || "",
        date: parsed.date?.toISOString() || new Date().toISOString(),
        attachments
      };

      const bodyText = parsed.text || "";
      await Promise.all([
        fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2)),
        fs.writeFile(path.join(dir, "body.txt"), bodyText),
        fs.writeFile(path.join(dir, "body.html"), textToHtml(bodyText))
      ]);

      await fs.rename(sourcePath, path.join(dropProcessedDir, file.name)).catch(async () => {
        await fs.rm(sourcePath, { force: true });
      });
    } catch {
      await fs.rename(sourcePath, path.join(dropFailedDir, file.name)).catch(() => {});
    }
  }
}
