import path from "node:path";
import { parseDomains } from "../domain/account-format.mjs";
export function configuration(env = process.env) {
  const dev = env.NODE_ENV !== "production";
  const DATA_DIR = env.MAIL_DATA_DIR || path.join(process.cwd(), "data");
  const ACCOUNT_DIR = env.MAIL_ACCOUNT_DIR || path.join(DATA_DIR, "accounts");
  const SESSION_SECRET =
    env.WEBMAIL_SESSION_SECRET || (dev ? "local-development-only" : "");
  if (
    !dev &&
    (SESSION_SECRET.length < 32 || SESSION_SECRET.startsWith("replace-with-"))
  )
    throw Error(
      "WEBMAIL_SESSION_SECRET must be a non-placeholder value of at least 32 characters",
    );
  return {
    dev,
    DATA_DIR,
    MAIL_ROOT: path.join(DATA_DIR, "mail"),
    TMP_ROOT: path.join(DATA_DIR, "tmp"),
    ACCOUNT_DIR,
    DOVECOT_USERS_PATH: path.join(ACCOUNT_DIR, "dovecot-users"),
    POSTFIX_ACCOUNTS_PATH: path.join(ACCOUNT_DIR, "virtual-mailbox-accounts"),
    DEFAULT_MAIL_DOMAIN: env.MAIL_DEFAULT_DOMAIN || "ds-mail.p-e.kr",
    MAIL_DOMAINS: parseDomains(
      env.MAIL_DOMAINS || env.MAIL_DEFAULT_DOMAIN || "ds-mail.p-e.kr",
    ),
    SESSION_SECRET,
    COOKIE_SECURE: env.WEBMAIL_COOKIE_SECURE === "true",
    MAX_AUTH_BODY_BYTES: 16384,
    MAX_ATTACHMENT_BYTES: 1024 ** 3,
    AUTH_COOKIE: "mailbox_user",
  };
}
