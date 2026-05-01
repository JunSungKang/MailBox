import http from "http";
import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import crypto from "crypto";
import next from "next";
import Busboy from "busboy";
import nodemailer from "nodemailer";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.BIND_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const DATA_DIR = process.env.MAIL_DATA_DIR || path.join(process.cwd(), "data");
const MAIL_ROOT = path.join(DATA_DIR, "mail");
const TMP_ROOT = path.join(DATA_DIR, "tmp");
const MAX_ATTACHMENT_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAIL_DOMAIN = process.env.MAIL_DEFAULT_DOMAIN || "ds-mail.p-e.kr";

const boxLabels = new Set(["inbox", "sent"]);

function safeSegment(value) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error("Invalid path segment");
  }
  return value;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function splitAddresses(value) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRecipient(value) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@${DEFAULT_MAIL_DOMAIN}`;
}

function normalizeSender(value) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed;
  if (trimmed) return `${trimmed}@${DEFAULT_MAIL_DOMAIN}`;
  return process.env.MAIL_FROM || "";
}

function generatedId() {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

async function ensureDirs() {
  await Promise.all([
    fsp.mkdir(path.join(MAIL_ROOT, "inbox"), { recursive: true }),
    fsp.mkdir(path.join(MAIL_ROOT, "sent"), { recursive: true }),
    fsp.mkdir(TMP_ROOT, { recursive: true }),
    fsp.mkdir(path.join(DATA_DIR, "drop", "inbox"), { recursive: true }),
    fsp.mkdir(path.join(DATA_DIR, "drop", "processed"), { recursive: true }),
    fsp.mkdir(path.join(DATA_DIR, "drop", "failed"), { recursive: true })
  ]);
}

async function removeDir(dir) {
  await fsp.rm(dir, { force: true, recursive: true }).catch(() => {});
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function sendText(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

async function sendViaConfiguredTransport(meta, bodyText, attachments) {
  const mail = {
    from: meta.from || process.env.MAIL_FROM || "webmail@localhost",
    to: meta.to.join(", "),
    subject: meta.subject || "(제목 없음)",
    text: bodyText,
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      path: attachment.path
    }))
  };

  if (process.env.SMTP_URL) {
    const transporter = nodemailer.createTransport(process.env.SMTP_URL);
    await transporter.sendMail(mail);
    return { attempted: true, ok: true, detail: "Postfix 접수 완료" };
  }

  const sendmailPath = process.env.SENDMAIL_PATH || "/usr/sbin/sendmail";
  if (fs.existsSync(sendmailPath)) {
    const transporter = nodemailer.createTransport({
      sendmail: true,
      newline: "unix",
      path: sendmailPath
    });
    await transporter.sendMail(mail);
    return { attempted: true, ok: true, detail: "sendmail 발송 완료" };
  }

  return { attempted: false, ok: false, detail: "SMTP_URL 또는 sendmail을 찾을 수 없습니다." };
}

async function handleSend(req, res) {
  await ensureDirs();

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    sendText(res, 415, "multipart/form-data 요청만 지원합니다.");
    return;
  }

  const requestId = generatedId();
  const tmpDir = path.join(TMP_ROOT, requestId);
  await fsp.mkdir(tmpDir, { recursive: true });

  const fields = {
    from: "",
    to: "",
    subject: "",
    body: ""
  };
  const uploaded = [];
  const fileWrites = [];
  let totalBytes = 0;
  let responded = false;

  const fail = async (status, message) => {
    if (responded) return;
    responded = true;
    req.unpipe();
    req.resume();
    await removeDir(tmpDir);
    sendText(res, status, message);
  };

  const busboy = Busboy({
    headers: req.headers,
    limits: {
      fileSize: MAX_ATTACHMENT_BYTES,
      fieldSize: 20 * 1024 * 1024
    }
  });

  busboy.on("field", (name, value) => {
    if (Object.hasOwn(fields, name)) {
      fields[name] = value;
    }
  });

  busboy.on("file", (name, file, info) => {
    if (name !== "attachments" || !info.filename) {
      file.resume();
      return;
    }

    const attachmentId = generatedId();
    const outputPath = path.join(tmpDir, attachmentId);
    const output = fs.createWriteStream(outputPath, { flags: "wx" });
    const attachment = {
      id: attachmentId,
      filename: path.basename(info.filename),
      contentType: info.mimeType || "application/octet-stream",
      size: 0,
      storedName: attachmentId,
      tempPath: outputPath
    };

    file.on("data", (chunk) => {
      attachment.size += chunk.length;
      totalBytes += chunk.length;
      if (attachment.size > MAX_ATTACHMENT_BYTES || totalBytes > MAX_ATTACHMENT_BYTES) {
        file.unpipe(output);
        output.destroy();
        void fail(413, "첨부파일은 1GB를 초과할 수 없습니다.");
      }
    });

    file.on("limit", () => {
      file.unpipe(output);
      output.destroy();
      void fail(413, "첨부파일은 1GB를 초과할 수 없습니다.");
    });

    file.pipe(output);

    fileWrites.push(
      new Promise((resolve, reject) => {
        output.on("finish", () => {
          if (!responded && attachment.size > 0) {
            uploaded.push(attachment);
          }
          resolve();
        });
        output.on("error", (error) => {
          if (responded) resolve();
          else reject(error);
        });
        file.on("error", (error) => {
          if (responded) resolve();
          else reject(error);
        });
      })
    );
  });

  busboy.on("error", () => {
    void fail(400, "메일 요청을 처리할 수 없습니다.");
  });

  busboy.on("finish", async () => {
    if (responded) return;

    try {
      await Promise.all(fileWrites);

      const to = splitAddresses(fields.to).map(normalizeRecipient);
      if (to.length === 0) {
        await fail(400, "받는 사람을 입력해야 합니다.");
        return;
      }

      const messageId = generatedId();
      const messageDir = path.join(MAIL_ROOT, "sent", messageId);
      const attachmentDir = path.join(messageDir, "attachments");
      await fsp.mkdir(attachmentDir, { recursive: true });

      const attachments = [];
      for (const item of uploaded) {
        const finalPath = path.join(attachmentDir, item.storedName);
        await fsp.rename(item.tempPath, finalPath);
        attachments.push({
          id: item.id,
          filename: item.filename,
          contentType: item.contentType,
          size: item.size,
          storedName: item.storedName,
          path: finalPath
        });
      }

      const bodyText = fields.body || "";
      const meta = {
        id: messageId,
        box: "sent",
        from: normalizeSender(fields.from),
        to,
        subject: fields.subject || "",
        date: new Date().toISOString(),
        attachments: attachments.map(({ path: _path, ...attachment }) => attachment)
      };

      try {
        meta.delivery = await sendViaConfiguredTransport(meta, bodyText, attachments);
      } catch (error) {
        meta.delivery = {
          attempted: true,
          ok: false,
          detail: error instanceof Error ? error.message : "발송 실패"
        };
      }

      await Promise.all([
        fsp.writeFile(path.join(messageDir, "meta.json"), JSON.stringify(meta, null, 2)),
        fsp.writeFile(path.join(messageDir, "body.txt"), bodyText),
        fsp.writeFile(path.join(messageDir, "body.html"), textToHtml(bodyText))
      ]);
      await removeDir(tmpDir);

      redirect(res, `/mail/sent/${messageId}`);
    } catch (error) {
      await removeDir(tmpDir);
      sendText(res, 500, error instanceof Error ? error.message : "메일을 저장할 수 없습니다.");
    }
  });

  req.pipe(busboy);
}

async function handleDownload(req, res, pathname) {
  const match = pathname.match(/^\/api\/mail\/([^/]+)\/([^/]+)\/attachments\/([^/]+)$/);
  if (!match) return false;

  const [, box, messageId, attachmentId] = match;
  if (!boxLabels.has(box)) {
    sendText(res, 404, "메일함을 찾을 수 없습니다.");
    return true;
  }

  try {
    const safeMessageId = safeSegment(messageId);
    const safeAttachmentId = safeSegment(attachmentId);
    const messageDir = path.join(MAIL_ROOT, box, safeMessageId);
    const meta = JSON.parse(await fsp.readFile(path.join(messageDir, "meta.json"), "utf8"));
    const attachment = meta.attachments.find((item) => item.id === safeAttachmentId);
    if (!attachment) {
      sendText(res, 404, "첨부파일을 찾을 수 없습니다.");
      return true;
    }

    const filePath = path.join(messageDir, "attachments", safeSegment(attachment.storedName));
    const stat = await fsp.stat(filePath);
    const encodedName = encodeURIComponent(attachment.filename);
    res.writeHead(200, {
      "Content-Type": attachment.contentType || "application/octet-stream",
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    sendText(res, 404, "첨부파일을 찾을 수 없습니다.");
  }

  return true;
}

await ensureDirs();
await app.prepare();

http
  .createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    if (req.method === "POST" && pathname === "/api/send") {
      await handleSend(req, res);
      return;
    }

    if (req.method === "GET" && (await handleDownload(req, res, pathname))) {
      return;
    }

    await handle(req, res);
  })
  .listen(port, hostname, () => {
    console.log(`mail web ready on http://${hostname}:${port}`);
  });
