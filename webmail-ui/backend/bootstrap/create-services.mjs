import { createAttachmentService } from "../application/get-attachment.mjs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { configuration } from "./config.mjs";
import { createAccountStore } from "../infrastructure/filesystem/account-repository.mjs";
import { createSubmissionTransport } from "../infrastructure/smtp/submission-adapter.mjs";
import { auditLog } from "../shared/audit-logger.mjs";
import { createRegisterAccount } from "../application/register-account.mjs";
import { createAuthenticator } from "../application/authenticate.mjs";
import { createSendMail } from "../application/send-mail.mjs";
import { createSentRepository } from "../infrastructure/filesystem/sent-repository.mjs";
import { createAuthHandler } from "../http/auth-handler.mjs";
import { createSendHandler } from "../http/send-handler.mjs";
import { createAttachmentHandler } from "../http/attachment-handler.mjs";
export function createServices(env = process.env) {
  const config = configuration(env);
  const {
    dev,
    DATA_DIR,
    MAIL_ROOT,
    TMP_ROOT,
    ACCOUNT_DIR,
    DOVECOT_USERS_PATH,
    POSTFIX_ACCOUNTS_PATH,
  } = config;
  async function ensureDirs() {
    await Promise.all([
      fsp.mkdir(path.join(MAIL_ROOT, "inbox"), { recursive: true }),
      fsp.mkdir(path.join(MAIL_ROOT, "sent"), { recursive: true }),
      fsp.mkdir(TMP_ROOT, { recursive: true }),
      fsp.mkdir(path.join(DATA_DIR, "drop", "inbox"), { recursive: true }),
      fsp.mkdir(path.join(DATA_DIR, "drop", "processed"), { recursive: true }),
      fsp.mkdir(path.join(DATA_DIR, "drop", "failed"), { recursive: true }),
    ]);
  }

  async function ensureAccountFiles() {
    await fsp.mkdir(ACCOUNT_DIR, { recursive: true });
    if (dev) {
      await Promise.all([
        fsp
          .writeFile(DOVECOT_USERS_PATH, "# MailBox development accounts\n", {
            flag: "wx",
            mode: 0o640,
          })
          .catch((error) => {
            if (error?.code !== "EEXIST") throw error;
          }),
        fsp
          .writeFile(
            POSTFIX_ACCOUNTS_PATH,
            "# MailBox development recipient map\n",
            { flag: "wx", mode: 0o640 },
          )
          .catch((error) => {
            if (error?.code !== "EEXIST") throw error;
          }),
      ]);
      return;
    }
    await Promise.all([
      fsp.access(DOVECOT_USERS_PATH),
      fsp.access(POSTFIX_ACCOUNTS_PATH),
    ]);
  }

  const accountStore = createAccountStore({
    directory: ACCOUNT_DIR,
    legacyUsersPath: path.join(DATA_DIR, "users.json"),
    domains: config.MAIL_DOMAINS,
    onRecovery: (event) =>
      auditLog("INFO", event, { actor: "system", status: "success" }),
  });
  const { handleAuth, requestUserId } = createAuthHandler({
    config,
    registerAccount: createRegisterAccount({
      accountStore,
      serviceUser: env.SMTP_AUTH_USER,
      servicePassword: env.SMTP_AUTH_PASSWORD,
    }),
    passwordMatchesAccount: createAuthenticator({
      usersPath: DOVECOT_USERS_PATH,
    }),
  });
  const sendMail = createSendMail({
    repository: createSentRepository(config.MAIL_ROOT),
    transport: createSubmissionTransport(env),
    domain: config.DEFAULT_MAIL_DOMAIN,
    audit: auditLog,
  });
  return {
    config,
    prepare: async () => {
      await Promise.all([ensureDirs(), ensureAccountFiles()]);
      await accountStore.recover();
    },
    handleAuth,
    handleSend: createSendHandler({
      config,
      requestUserId,
      ensureDirs,
      sendMail,
    }),
    handleDownload: createAttachmentHandler({
      requestUserId,
      getAttachment: createAttachmentService({ root: config.MAIL_ROOT }),
    }),
  };
}
