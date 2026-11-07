import fs from "node:fs";
import nodemailer from "nodemailer";

export function submissionOptions(env = process.env) {
  const port = Number(env.SMTP_SUBMISSION_PORT || 2587);
  if (env.SMTP_URL || env.SENDMAIL_PATH) throw new Error("Legacy SMTP_URL/SENDMAIL_PATH is forbidden; configure secure submission");
  if (!env.SMTP_HOST || !env.SMTP_TLS_SERVERNAME || !env.SMTP_AUTH_USER ||
      !env.SMTP_AUTH_PASSWORD || env.SMTP_AUTH_PASSWORD.length < 32 ||
      env.SMTP_AUTH_PASSWORD.startsWith("replace-with-") ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Secure SMTP submission configuration is incomplete");
  }
  return {
    host: env.SMTP_HOST,
    port,
    secure: false,
    requireTLS: true,
    ignoreTLS: false,
    auth: { user: env.SMTP_AUTH_USER, pass: env.SMTP_AUTH_PASSWORD },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      servername: env.SMTP_TLS_SERVERNAME,
      ...(env.SMTP_TLS_CA_FILE ? { ca: fs.readFileSync(env.SMTP_TLS_CA_FILE) } : {})
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    logger: false,
    debug: false
  };
}

export function createSubmissionTransport(env = process.env) {
  return nodemailer.createTransport(submissionOptions(env));
}

export function safeSmtpError(error) {
  // Raw responses/messages may contain addresses or authentication material.
  const allowed = new Set(["ETLS", "ESOCKET", "EAUTH", "ECONNECTION", "ETIMEDOUT", "EENVELOPE", "EMESSAGE"]);
  return { code: allowed.has(error?.code) ? error.code : "SMTP_FAILURE" };
}
