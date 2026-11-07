import http from "http";
import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import crypto from "crypto";
import next from "next";
import Busboy from "busboy";
import bcrypt from "bcryptjs";
import { createSubmissionTransport, safeSmtpError } from "./smtp-transport.mjs";
import { isValidUserId, normalizeUserId, sessionToken, verifySessionToken } from "./auth-core.mjs";
import { mergeDovecotUser, mergePostfixAccounts, parseDomains, parseDovecotUsers } from "./account-core.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.BIND_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const DATA_DIR = process.env.MAIL_DATA_DIR || path.join(process.cwd(), "data");
const MAIL_ROOT = path.join(DATA_DIR, "mail");
const TMP_ROOT = path.join(DATA_DIR, "tmp");
const ACCOUNT_DIR = process.env.MAIL_ACCOUNT_DIR || path.join(DATA_DIR, "accounts");
const DOVECOT_USERS_PATH = path.join(ACCOUNT_DIR, "dovecot-users");
const POSTFIX_ACCOUNTS_PATH = path.join(ACCOUNT_DIR, "virtual-mailbox-accounts");
const ACCOUNT_LOCK_PATH = path.join(ACCOUNT_DIR, ".signup.lock");
const MAX_ATTACHMENT_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAIL_DOMAIN = process.env.MAIL_DEFAULT_DOMAIN || "ds-mail.p-e.kr";
const MAIL_DOMAINS = parseDomains(process.env.MAIL_DOMAINS || DEFAULT_MAIL_DOMAIN);
const AUTH_COOKIE = "mailbox_user";
const SESSION_SECRET = process.env.WEBMAIL_SESSION_SECRET || (dev ? "local-development-only" : "");
const SIGNUP_TOKEN = process.env.WEBMAIL_SIGNUP_TOKEN || (dev ? "local-signup-token" : "");
const COOKIE_SECURE = process.env.WEBMAIL_COOKIE_SECURE === "true";
const PASSWORD_MIN_LENGTH = 12;
const MAX_AUTH_BODY_BYTES = 16 * 1024;

if (!dev && (SESSION_SECRET.length < 32 || SESSION_SECRET.startsWith("replace-with-"))) {
  throw new Error("WEBMAIL_SESSION_SECRET must be a non-placeholder value of at least 32 characters");
}
if (!dev && (SIGNUP_TOKEN.length < 16 || SIGNUP_TOKEN.startsWith("replace-with-"))) {
  throw new Error("WEBMAIL_SIGNUP_TOKEN must be a non-placeholder value of at least 16 characters");
}

const submissionTransport = createSubmissionTransport();

const boxLabels = new Set(["inbox", "sent", "bounced"]);

function serializeAuditValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (Array.isArray(value)) {
    return value.map(serializeAuditValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeAuditValue(item)])
    );
  }
  return value;
}

function auditLog(level, event, fields = {}) {
  const line = JSON.stringify(
    serializeAuditValue({
      time: new Date().toISOString(),
      level,
      event,
      ...fields
    })
  );
  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

function auditWarn(event, fields = {}) {
  auditLog("WARN", event, fields);
}

function auditError(event, fields = {}) {
  auditLog("ERROR", event, fields);
}

function requestContext(req, pathOverride) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor || "").split(",")[0].trim() || req.headers["x-real-ip"];
  return {
    requestId: req.headers["x-request-id"] || generatedId(),
    actor: "anonymous",
    ip,
    userAgent: req.headers["user-agent"],
    method: req.method,
    path: pathOverride || req.url || ""
  };
}

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

function isValidPassword(value) {
  return typeof value === "string" && value.length >= PASSWORD_MIN_LENGTH && value.length <= 128;
}

function requestUserId(req) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [name, ...parts] = cookie.trim().split("=");
    if (name === AUTH_COOKIE) {
      try {
        return verifySessionToken(decodeURIComponent(parts.join("=")), SESSION_SECRET);
      } catch {
        return "";
      }
    }
  }
  return "";
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

async function ensureAccountFiles() {
  await fsp.mkdir(ACCOUNT_DIR, { recursive: true });
  if (dev) {
    await Promise.all([
      fsp.writeFile(DOVECOT_USERS_PATH, "# MailBox development accounts\n", { flag: "wx", mode: 0o640 }).catch((error) => {
        if (error?.code !== "EEXIST") throw error;
      }),
      fsp.writeFile(POSTFIX_ACCOUNTS_PATH, "# MailBox development recipient map\n", { flag: "wx", mode: 0o640 }).catch((error) => {
        if (error?.code !== "EEXIST") throw error;
      })
    ]);
    return;
  }
  await Promise.all([fsp.access(DOVECOT_USERS_PATH), fsp.access(POSTFIX_ACCOUNTS_PATH)]);
}

async function readAccountFiles() {
  const [dovecotUsers, postfixAccounts] = await Promise.all([
    fsp.readFile(DOVECOT_USERS_PATH, "utf8"),
    fsp.readFile(POSTFIX_ACCOUNTS_PATH, "utf8")
  ]);
  return { dovecotUsers, postfixAccounts };
}

async function passwordMatchesAccount(userId, password) {
  const raw = await fsp.readFile(DOVECOT_USERS_PATH, "utf8").catch(() => "");
  const account = parseDovecotUsers(raw).find((item) => item.id === userId);
  if (!account) return false;
  if (!account.passwordHash.startsWith("{BLF-CRYPT}")) return false;
  return bcrypt.compare(password, account.passwordHash.slice("{BLF-CRYPT}".length));
}

async function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.${generatedId()}.tmp`;
  await fsp.writeFile(tempPath, content, { encoding: "utf8", mode: 0o640, flag: "wx" });
  await fsp.rename(tempPath, filePath);
}

async function withAccountLock(callback) {
  await fsp.mkdir(ACCOUNT_DIR, { recursive: true });
  let handle;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      handle = await fsp.open(ACCOUNT_LOCK_PATH, "wx", 0o600);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const stat = await fsp.stat(ACCOUNT_LOCK_PATH).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > 30_000) {
        await fsp.unlink(ACCOUNT_LOCK_PATH).catch(() => {});
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  if (!handle) throw new Error("Account store is busy");
  try {
    return await callback();
  } finally {
    await handle.close().catch(() => {});
    await fsp.unlink(ACCOUNT_LOCK_PATH).catch(() => {});
  }
}

async function provisionAccount(userId, password) {
  return withAccountLock(async () => {
    const { dovecotUsers, postfixAccounts } = await readAccountFiles();
    if (parseDovecotUsers(dovecotUsers).some((account) => account.id === userId)) {
      const error = new Error("Account already exists");
      error.code = "ACCOUNT_EXISTS";
      throw error;
    }
    const passwordHash = `{BLF-CRYPT}${await bcrypt.hash(password, 12)}`;
    const nextDovecotUsers = mergeDovecotUser(dovecotUsers, userId, passwordHash);
    const nextPostfixAccounts = mergePostfixAccounts(postfixAccounts, userId, MAIL_DOMAINS);
    await atomicWrite(DOVECOT_USERS_PATH, nextDovecotUsers);
    try {
      await atomicWrite(POSTFIX_ACCOUNTS_PATH, nextPostfixAccounts);
    } catch (error) {
      await atomicWrite(DOVECOT_USERS_PATH, dovecotUsers);
      throw error;
    }
    return { addressCount: MAIL_DOMAINS.length, domains: MAIL_DOMAINS };
  });
}

async function parseUrlEncodedForm(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_AUTH_BODY_BYTES) {
      throw new Error("Authentication request body is too large");
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return new URLSearchParams(body);
}

function setAuthCookie(res, userId) {
  const secure = COOKIE_SECURE ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE}=${encodeURIComponent(sessionToken(userId, SESSION_SECRET))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`
  );
}

function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
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

async function handleAuth(req, res, pathname) {
  const startedAt = Date.now();
  const context = requestContext(req, pathname);

  if (pathname === "/api/auth/logout") {
    clearAuthCookie(res);
    auditLog("INFO", "auth.logout", {
      ...context,
      durationMs: Date.now() - startedAt
    });
    redirect(res, "/inbox");
    return true;
  }

  if (pathname !== "/api/auth/login" && pathname !== "/api/auth/signup") {
    return false;
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    sendText(res, 415, "application/x-www-form-urlencoded 요청만 지원합니다.");
    return true;
  }

  let form;
  try {
    form = await parseUrlEncodedForm(req);
  } catch (error) {
    auditWarn("auth.request.rejected", { ...context, status: 413, error, durationMs: Date.now() - startedAt });
    sendText(res, 413, "인증 요청 본문이 너무 큽니다.");
    return true;
  }
  const userId = normalizeUserId(form.get("userId")?.toString());
  const password = form.get("password")?.toString() || "";
  const signupToken = form.get("signupToken")?.toString() || "";
  if (!isValidUserId(userId)) {
    redirect(res, pathname === "/api/auth/login" ? "/login?error=invalid" : "/signup?error=invalid");
    return true;
  }

  if (pathname === "/api/auth/login") {
    try {
      if (!(await passwordMatchesAccount(userId, password))) {
        auditWarn("auth.login.invalid_credentials", {
          ...context,
          userId,
          durationMs: Date.now() - startedAt
        });
        redirect(res, "/login?error=invalid_credentials");
        return true;
      }
    } catch (error) {
      auditError("auth.login.backend_failure", {
        ...context,
        userId,
        status: 503,
        error,
        durationMs: Date.now() - startedAt
      });
      redirect(res, "/login?error=unavailable");
      return true;
    }
  }

  let provisionedAccount;
  if (pathname === "/api/auth/signup") {
    const validSignupToken =
      signupToken.length === SIGNUP_TOKEN.length &&
      crypto.timingSafeEqual(Buffer.from(signupToken), Buffer.from(SIGNUP_TOKEN));
    if (!validSignupToken) {
      auditWarn("auth.signup.invalid_token", { ...context, userId, durationMs: Date.now() - startedAt });
      redirect(res, "/signup?error=invalid_signup_token");
      return true;
    }
    if (!isValidPassword(password)) {
      redirect(res, "/signup?error=weak_password");
      return true;
    }
    try {
      provisionedAccount = await provisionAccount(userId, password);
    } catch (error) {
      if (error?.code === "ACCOUNT_EXISTS") {
        auditWarn("auth.signup.exists", {
          ...context,
          userId,
          durationMs: Date.now() - startedAt
        });
        redirect(res, "/signup?error=exists");
        return true;
      }
      auditError("auth.signup.provision_failure", {
        ...context,
        userId,
        status: 503,
        error,
        durationMs: Date.now() - startedAt
      });
      redirect(res, "/signup?error=unavailable");
      return true;
    }
  }

  setAuthCookie(res, userId);
  auditLog("INFO", pathname === "/api/auth/signup" ? "auth.signup.success" : "auth.login.success", {
    ...context,
    actor: userId,
    userId,
    addressCount: provisionedAccount?.addressCount,
    domains: provisionedAccount?.domains,
    durationMs: Date.now() - startedAt
  });
  redirect(res, "/inbox");
  return true;
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

  await submissionTransport.sendMail(mail);
  return { attempted: true, ok: true, detail: "Postfix 접수 완료" };
}

async function handleSend(req, res) {
  const startedAt = Date.now();
  const userId = requestUserId(req);
  const context = { ...requestContext(req, "/api/send"), actor: userId || "anonymous" };
  if (!userId) {
    auditWarn("mail.send.unauthorized", { ...context, status: 401, durationMs: Date.now() - startedAt });
    redirect(res, "/login");
    return;
  }
  await ensureDirs();

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    auditWarn("mail.send.invalid_content_type", {
      ...context,
      status: 415,
      contentType,
      durationMs: Date.now() - startedAt
    });
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
    auditWarn("mail.send.rejected", {
      ...context,
      status,
      reason: message,
      from: normalizeSender(fields.from) || undefined,
      recipientCount: splitAddresses(fields.to).length,
      attachmentCount: uploaded.length,
      attachmentBytes: totalBytes,
      durationMs: Date.now() - startedAt
    });
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
    auditWarn("mail.send.parse_failure", {
      ...context,
      durationMs: Date.now() - startedAt
    });
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
        from: `${userId}@${DEFAULT_MAIL_DOMAIN}`,
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
          detail: "보안 SMTP 제출에 실패했습니다. 연결 및 인증 설정을 확인하세요."
        };
        auditError("mail.send.smtp_failure", {
          ...context,
          actor: meta.from || context.actor,
          messageId,
          from: meta.from,
          recipientCount: meta.to.length,
          recipientDomains: [...new Set(meta.to.map((recipient) => recipient.split("@")[1]).filter(Boolean))],
          attachmentCount: attachments.length,
          attachmentBytes: attachments.reduce((sum, attachment) => sum + attachment.size, 0),
          error: safeSmtpError(error)
        });
      }

      await Promise.all([
        fsp.writeFile(path.join(messageDir, "meta.json"), JSON.stringify(meta, null, 2)),
        fsp.writeFile(path.join(messageDir, "body.txt"), bodyText),
        fsp.writeFile(path.join(messageDir, "body.html"), textToHtml(bodyText))
      ]);
      await removeDir(tmpDir);

      auditLog(meta.delivery?.ok ? "INFO" : "WARN", meta.delivery?.ok ? "mail.send.success" : "mail.send.delivery_unavailable", {
        ...context,
        actor: meta.from || context.actor,
        messageId,
        from: meta.from,
        recipientCount: meta.to.length,
        recipientDomains: [...new Set(meta.to.map((recipient) => recipient.split("@")[1]).filter(Boolean))],
        attachmentCount: attachments.length,
        attachmentBytes: attachments.reduce((sum, attachment) => sum + attachment.size, 0),
        deliveryAttempted: meta.delivery?.attempted || false,
        deliveryOk: meta.delivery?.ok || false,
        durationMs: Date.now() - startedAt
      });
      redirect(res, `/mail/sent/${messageId}`);
    } catch (error) {
      await removeDir(tmpDir);
      auditLog(responded ? "WARN" : "ERROR", "mail.send.storage_failure", {
        ...context,
        status: 500,
        from: normalizeSender(fields.from) || undefined,
        recipientCount: splitAddresses(fields.to).length,
        attachmentCount: uploaded.length,
        attachmentBytes: totalBytes,
        error,
        durationMs: Date.now() - startedAt
      });
      sendText(res, 500, error instanceof Error ? error.message : "메일을 저장할 수 없습니다.");
    }
  });

  req.pipe(busboy);
}

async function handleDownload(req, res, pathname) {
  const startedAt = Date.now();
  const userId = requestUserId(req);
  const context = { ...requestContext(req, pathname), actor: userId || "anonymous" };
  const match = pathname.match(/^\/api\/mail\/([^/]+)\/([^/]+)\/attachments\/([^/]+)$/);
  if (!match) return false;
  if (!userId) {
    auditWarn("mail.attachment.unauthorized", { ...context, status: 401, durationMs: Date.now() - startedAt });
    sendText(res, 401, "로그인이 필요합니다.");
    return true;
  }

  const [, box, messageId, attachmentId] = match;
  if (!boxLabels.has(box)) {
    auditWarn("mail.attachment.invalid_box", {
      ...context,
      box,
      messageId,
      attachmentId,
      status: 404,
      durationMs: Date.now() - startedAt
    });
    sendText(res, 404, "메일함을 찾을 수 없습니다.");
    return true;
  }

  try {
    const safeMessageId = safeSegment(messageId);
    const safeAttachmentId = safeSegment(attachmentId);
    const messageDir = path.join(MAIL_ROOT, box, safeMessageId);
    const meta = JSON.parse(await fsp.readFile(path.join(messageDir, "meta.json"), "utf8"));
    if (!messageOwnedByUser(meta, userId)) {
      auditWarn("mail.attachment.forbidden", { ...context, box, messageId, status: 403, durationMs: Date.now() - startedAt });
      sendText(res, 403, "이 첨부파일에 접근할 수 없습니다.");
      return true;
    }
    const attachment = meta.attachments.find((item) => item.id === safeAttachmentId);
    if (!attachment) {
      auditWarn("mail.attachment.not_found", {
        ...context,
        box,
        messageId,
        attachmentId,
        status: 404,
        durationMs: Date.now() - startedAt
      });
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
    auditLog("INFO", "mail.attachment.download", {
      ...context,
      box,
      messageId,
      attachmentId,
      attachmentBytes: stat.size,
      contentType: attachment.contentType || "application/octet-stream",
      durationMs: Date.now() - startedAt
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    auditError("mail.attachment.failure", {
      ...context,
      box,
      messageId,
      attachmentId,
      status: 404,
      error,
      durationMs: Date.now() - startedAt
    });
    sendText(res, 404, "첨부파일을 찾을 수 없습니다.");
  }

  return true;
}

function addressBelongsToUser(value, userId) {
  const addresses = String(value || "").toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+/g) || [];
  return addresses.some((address) => address.split("@")[0] === userId);
}

function messageOwnedByUser(meta, userId) {
  if (meta.box === "sent") return addressBelongsToUser(meta.from, userId);
  return Array.isArray(meta.to) && meta.to.some((recipient) => addressBelongsToUser(recipient, userId));
}

await Promise.all([ensureDirs(), ensureAccountFiles()]);
await app.prepare();

http
  .createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    if (req.method === "POST" && pathname === "/api/send") {
      await handleSend(req, res);
      return;
    }

    if (req.method === "POST" && (await handleAuth(req, res, pathname))) {
      return;
    }

    if (req.method === "GET" && (await handleDownload(req, res, pathname))) {
      return;
    }

    await handle(req, res);
  })
  .listen(port, hostname, () => {
    auditLog("INFO", "server.start", {
      hostname,
      port,
      nodeEnv: process.env.NODE_ENV || "development",
      dataDir: DATA_DIR
    });
  });
