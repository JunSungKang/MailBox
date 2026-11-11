import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { parseMailFile } from "./parseMailFile";
import { boundedMap } from "./boundedMap";
import { auditError, auditInfo, auditWarn } from "./auditLogger";
import { textToHtml } from "./text";
import { canonicalMaildirKey } from "./maildirIdentity";

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
  inbox: "받은 편지",
  sent: "보낸 편지",
  bounced: "돌아온 편지"
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
  const messages = await boundedMap(
    entries.filter((entry) => entry.isDirectory()), 32, async (entry) => {
        try {
          const raw = await fs.readFile(path.join(boxDir(box), entry.name, "meta.json"), "utf8");
          return JSON.parse(raw) as MailMeta;
        } catch {
          return null;
        }
      }
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
  const temporary = `${maildirImportStatePath}.${crypto.randomUUID()}.tmp`;
  const existing = await fs.stat(maildirImportStatePath).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing && (existing.uid !== process.getuid?.() || existing.gid !== process.getgid?.())) {
    throw new Error("Import ledger ownership mismatch");
  }
  try {
    await fs.writeFile(temporary, JSON.stringify([...values].sort(), null, 2), { flag: "wx", mode: existing ? existing.mode & 0o777 : 0o644 });
    await fs.rename(temporary, maildirImportStatePath);
  } finally {
    await fs.rm(temporary, { force: true });
  }
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
  const sourceFiles = await boundedMap(
    sources, 4, async (source) => {
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
    }
  );

  return sourceFiles.flat();
}

let maildirImportPromise: Promise<void> | undefined;
function ingestMaildir(): Promise<void> {
  // One Webmail writer owns this volume. Concurrent SSR requests share a batch.
  maildirImportPromise ??= ingestMaildirBatch().finally(() => { maildirImportPromise = undefined; });
  return maildirImportPromise;
}

async function ingestMaildirBatch(): Promise<void> {
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
    sourceCount: maildirFiles.length
  });

  for (const { sourcePath, importKey } of maildirFiles) {
    const identity = canonicalMaildirKey(importKey);
    if (knownIdentities.has(identity)) {
      if (!imported.has(importKey)) {
        // Keep old entries and add the current raw path for rollback readers.
        imported.add(importKey);
        changed = true;
        auditInfo("mail.import.maildir.alias.success", {
          actor: "system", method: "IMPORT", path: "maildir", status: "success",
          sourceIdentity: crypto.createHash("sha256").update(identity).digest("hex")
        });
      }
      skippedCount += 1;
      continue;
    }

    let staging: string | undefined;
    let unfinished: string | undefined;
    try {
      const messageId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const stagingPath = path.join(dataDir, "tmp", `import-${messageId}`);
      await fs.mkdir(stagingPath);
      staging = stagingPath;
      let parsed;
      try { parsed = await parseMailFile(sourcePath, path.join(staging, "attachments")); }
      catch (error) { await fs.rm(staging, { recursive: true, force: true }); throw error; }
      const targetBox: MailBox = isBounceSource(
        addressText(parsed.from) || headerText(parsed.headers.get("return-path")),
        parsed.subject || "",
        headerText(parsed.headers.get("auto-submitted")),
        headerText(parsed.headers.get("content-type"))
      )
        ? "bounced"
        : "inbox";
      const dir = messageDir(targetBox, messageId);
      await fs.rename(staging, dir);
      staging = undefined;
      unfinished = dir;
      const attachments: AttachmentMeta[] = parsed.attachments;

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
        attachmentCount: attachments.length
      });
    } catch (error) {
      if (staging || unfinished) await fs.rm((staging || unfinished)!, { recursive: true, force: true });
      failedCount += 1;
      auditError("mail.import.maildir.message.failure", {
        sourcePath,
        importKey,
        error
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
    durationMs: Date.now() - startedAt
  });
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
      auditInfo("mail.bounce.copy.success", {
        messageId: entry.name,
        sourceBox: "inbox",
        targetBox: "bounced"
      });
    } catch {
      auditWarn("mail.bounce.copy.failure", {
        messageId: entry.name
      });
      continue;
    }
  }
}

let inboxDropPromise: Promise<void> | undefined;
function ingestInboxDrop(): Promise<void> {
  inboxDropPromise ??= ingestInboxDropBatch().finally(() => { inboxDropPromise = undefined; });
  return inboxDropPromise;
}

async function ingestInboxDropBatch(): Promise<void> {
  const entries = await fs.readdir(dropInboxDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".eml"));
  if (files.length > 0) {
    auditInfo("mail.import.drop.start", {
      sourceCount: files.length
    });
  }

  for (const file of files) {
    const sourcePath = path.join(dropInboxDir, file.name);
    let staging: string | undefined;
    let unfinished: string | undefined;
    try {
      const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const stagingPath = path.join(dataDir, "tmp", `import-${id}`);
      await fs.mkdir(stagingPath);
      staging = stagingPath;
      let parsed;
      try { parsed = await parseMailFile(sourcePath, path.join(staging, "attachments")); }
      catch (error) { await fs.rm(staging, { recursive: true, force: true }); throw error; }
      const targetBox: MailBox = isBounceSource(
        addressText(parsed.from),
        parsed.subject || "",
        headerText(parsed.headers.get("auto-submitted")),
        headerText(parsed.headers.get("content-type"))
      )
        ? "bounced"
        : "inbox";
      const dir = messageDir(targetBox, id);
      await fs.rename(staging, dir);
      staging = undefined;
      unfinished = dir;
      const attachments: AttachmentMeta[] = parsed.attachments;

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

      unfinished = undefined;
      await fs.rename(sourcePath, path.join(dropProcessedDir, file.name)).catch(async () => {
        await fs.rm(sourcePath, { force: true });
      });
      auditInfo("mail.import.drop.message.success", {
        sourceFile: file.name,
        messageId: id,
        box: targetBox,
        attachmentCount: attachments.length
      });
    } catch (error) {
      if (staging || unfinished) await fs.rm((staging || unfinished)!, { recursive: true, force: true });
      await fs.rename(sourcePath, path.join(dropFailedDir, file.name)).catch(() => {});
      auditError("mail.import.drop.message.failure", {
        sourceFile: file.name,
        error
      });
    }
  }
}
