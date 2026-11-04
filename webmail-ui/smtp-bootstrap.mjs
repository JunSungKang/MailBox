// Reuses the account provisioning API; never edits the shared account files.
import { createSubmissionTransport } from "./smtp-transport.mjs";

const log = (level, event) => console.log(JSON.stringify({
  time: new Date().toISOString(), level, event, actor: "smtp-bootstrap"
}));

try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/auth/signup`, {
    method: "POST",
    redirect: "manual",
    body: new URLSearchParams({ userId: process.env.SMTP_AUTH_USER,
      password: process.env.SMTP_AUTH_PASSWORD, signupToken: process.env.WEBMAIL_SIGNUP_TOKEN })
  });
  const location = response.headers.get("location");
  if (response.status !== 303 || !["/inbox", "/signup?error=exists"].includes(location)) {
    throw new Error("Account provisioning failed");
  }
  // Also checks an existing account's password instead of silently overwriting it.
  await createSubmissionTransport().verify();
  log("INFO", "mail.submission.provision.success");
} catch {
  log("ERROR", "mail.submission.provision.failure");
  process.exitCode = 1;
}
