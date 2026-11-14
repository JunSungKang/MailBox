// Reuses the account provisioning API; never edits the shared account files.
import { createSubmissionTransport } from "./smtp-transport.mjs";
import { fileURLToPath } from "node:url";

const log = (level, event) => console.log(JSON.stringify({
  time: new Date().toISOString(), level, event, actor: "smtp-bootstrap"
}));

export async function ensureSubmissionAccount({ env = process.env, fetchImpl = fetch,
  verify = async () => {
    const transport = createSubmissionTransport(env);
    try { await transport.verify(); } finally { transport.close(); }
  } } = {}) {
  // Existing credentials are independent of the policy for creating new ones.
  try {
    await verify();
    return;
  } catch (error) {
    // A TLS/network failure must not trigger account creation or plaintext retry.
    if (error?.code !== "EAUTH") throw error;
  }
  const response = await fetchImpl(`http://127.0.0.1:${env.PORT || 3000}/api/auth/signup`, {
    method: "POST",
    redirect: "manual",
    body: new URLSearchParams({ userId: env.SMTP_AUTH_USER,
      password: env.SMTP_AUTH_PASSWORD })
  });
  const location = response.headers.get("location");
  if (response.status !== 303 || !["/inbox", "/signup?error=exists"].includes(location)) {
    throw new Error("Account provisioning failed");
  }
  // Also checks an existing account's password instead of silently overwriting it.
  await verify();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await ensureSubmissionAccount();
    log("INFO", "mail.submission.provision.success");
  } catch {
    log("ERROR", "mail.submission.provision.failure");
    process.exitCode = 1;
  }
}
