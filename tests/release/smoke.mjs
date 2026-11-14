// Disposable native-architecture validation. Never selects operating services or volumes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = fs.realpathSync(process.cwd());
const directory = fs.realpathSync(path.resolve(process.env.CHECK_DIR || ""));
assert(directory.startsWith(root + path.sep));
const tag = process.env.TAG; assert.match(tag || "", /^[a-z0-9][a-z0-9_.-]+$/);
fs.mkdirSync(directory + "/reports", { recursive: true, mode: 0o700 });
const fixture = fs.mkdtempSync(directory + "/fixture-");
const prefix = "mailbox-package-fixture-" + crypto.randomBytes(8).toString("hex");
const images = Object.fromEntries(["smtp", "imap", "web"].map((k, i) => [k, `mailbox-${["smtp-receiver", "imap-mailbox", "webmail-ui"][i]}:${tag}`]));
const docker = (args, options = {}) => execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024, ...options });
const save = (file, value) => fs.writeFileSync(directory + "/reports/" + file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
const password = crypto.randomBytes(32).toString("hex");
const env = { SMTP_HOST: "smtp", SMTP_SUBMISSION_PORT: "587", SMTP_TLS_SERVERNAME: "fixture.test", SMTP_TLS_CA_FILE: "/tls/ca.pem",
  SMTP_AUTH_USER: "fixture-service", SMTP_AUTH_PASSWORD: password, WEBMAIL_SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  WEBMAIL_COOKIE_SECURE: "true", MAIL_DOMAINS: "fixture.test", MAIL_DEFAULT_DOMAIN: "fixture.test", MAIL_ACCOUNT_DIR: "/accounts",
  MAILDIR_IMPORT_PARENT_DIR: "/mailboxes", FIXTURE_PASSWORD: crypto.randomBytes(20).toString("hex") };
let prepared = false;
const compose = (...args) => docker(["compose", "-p", prefix, "--project-directory", root, "--env-file", fixture + "/empty.env", "-f", fixture + "/compose.json", ...args]);
try {
  fs.mkdirSync(fixture + "/tls", { mode: 0o700 });
  fs.writeFileSync(fixture + "/tls/request.cnf", "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=fixture.test\n[ext]\nsubjectAltName=DNS:fixture.test\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\n", { mode: 0o600 });
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-config", fixture + "/tls/request.cnf", "-keyout", fixture + "/tls/privkey.pem", "-out", fixture + "/tls/fullchain.pem"], { stdio: "ignore", env: { ...process.env, RANDFILE: fixture + "/.rnd" } });
  fs.copyFileSync(fixture + "/tls/fullchain.pem", fixture + "/tls/ca.pem");
  fs.chmodSync(fixture + "/tls/privkey.pem", 0o600); fs.writeFileSync(fixture + "/empty.env", "", { mode: 0o600 });
  const volumes = Object.fromEntries(["mail", "accounts", "queue", "auth", "data"].map(k => [k, { name: prefix + "-" + k }]));
  const tls = { type: "bind", source: fixture + "/tls", target: "/etc/mailbox/tls", read_only: true, bind: { create_host_path: false } };
  const services = {
    smtp: { image: images.smtp, environment: { MAIL_HOSTNAME: "fixture.test", MAIL_DOMAINS: "fixture.test", SMTP_AUTH_USER: env.SMTP_AUTH_USER }, volumes: ["mail:/var/mail/vhosts", "accounts:/accounts", "queue:/var/spool/postfix", "auth:/run/smtp-auth:ro", tls] },
    imap: { image: images.imap, volumes: ["mail:/var/mail/vhosts", "accounts:/accounts", "auth:/run/smtp-auth", tls] },
    web: { image: images.web, environment: env, volumes: ["mail:/mailboxes:ro", "accounts:/accounts", "data:/app/data",
      { type: "bind", source: fixture + "/tls/ca.pem", target: "/tls/ca.pem", read_only: true },
      { type: "bind", source: root + "/tests/platform", target: "/checks", read_only: true }] }
  };
  fs.writeFileSync(fixture + "/compose.json", JSON.stringify({ services, volumes, networks: { default: { name: prefix, internal: true } } }), { mode: 0o600 });
  compose("config", "--quiet"); prepared = true; compose("up", "-d", "--pull", "never", "--no-build");
  const exec = (...args) => compose("exec", "-T", "--user", "5000:5000", "web", ...args);
  exec("node", "--input-type=module", "-e", 'for(let i=0;i<100;i++){try{if((await fetch("http://127.0.0.1:3000/signup")).status===200)process.exit(0)}catch{}await new Promise(r=>setTimeout(r,300));}process.exit(1)');
  const peerEnv = fixture + "/peer.env";
  fs.writeFileSync(peerEnv, Object.entries(env).map(([k, v]) => k + "=" + v).join("\n") + "\n", { mode: 0o600 });
  docker(["run", "--rm", "--read-only", "--network", prefix, "--env-file", peerEnv, "--entrypoint", "node", images.web, "--input-type=module", "-e",
    'const r=await fetch("http://web:3000/api/auth/signup",{method:"POST",redirect:"manual",headers:{"X-Forwarded-For":"127.0.0.1","X-Real-IP":"127.0.0.1"},body:new URLSearchParams({userId:process.env.SMTP_AUTH_USER,password:process.env.SMTP_AUTH_PASSWORD})});if(r.status!==303||r.headers.get("location")!=="/signup?error=exists"||r.headers.has("set-cookie"))throw Error("Untrusted service signup accepted");']);
  const bootstrap = async () => {
    const attempts = [];
    for (let i = 0; i < 20; i++) {
      try {
        exec("node", "--input-type=module", "-e", 'import {ensureSubmissionAccount} from "/app/smtp-bootstrap.mjs";import {safeSmtpError} from "/app/smtp-transport.mjs";try{await ensureSubmissionAccount()}catch(e){console.log(JSON.stringify(safeSmtpError(e)));process.exit(1)}');
        save("bootstrap-attempts.json", { status: "success", attempts }); return;
      } catch (error) {
        attempts.push({ attempt: i + 1, error: error.stdout?.toString().trim() || "bootstrap unavailable" });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    save("bootstrap-attempts.json", { status: "failed", attempts }); throw Error("Fixture bootstrap did not become ready");
  };
  await bootstrap();
  const smtp = JSON.parse(exec("node", "/checks/smtp-check.mjs")); save("smtp.json", smtp);
  const passwords = JSON.parse(exec("node", "/checks/password-check.mjs")); save("passwords.json", passwords);
  const webCheck = 'const r=await fetch("http://127.0.0.1:3000/signup");const html=await r.text();const ref=process.env.MAILBOX_SOURCE_REVISION;const source=/^[a-f0-9]{40}$/.test(ref||"")?ref:"main";if(r.status!==200||html.includes("name=\\"signupToken\\"")||!html.includes("/archive/"+source+".tar.gz")||!html.includes("AGPL-3.0-only"))throw Error("Signup/source offer failed");';
  exec("node", "--input-type=module", "-e", webCheck);
  const id = compose("ps", "-q", "web").trim(); compose("stop", "--timeout", "60", "web");
  const stopped = JSON.parse(docker(["inspect", "--format", "{{json .State}}", id])); assert.equal(stopped.ExitCode, 0); assert.equal(stopped.OOMKilled, false);
  compose("start", "web"); exec("node", "--input-type=module", "-e", 'for(let i=0;i<100;i++){try{if((await fetch("http://127.0.0.1:3000/signup")).status===200)process.exit(0)}catch{}await new Promise(r=>setTimeout(r,300));}process.exit(1)');
  exec("node", "--input-type=module", "-e", webCheck); await bootstrap();
  save("smoke.json", { status: "success", images, internalNetwork: true, untrustedPeerDeniedBeforeBootstrap: true,
    sourceOffer: true, signupWithoutCode: true, smtpAndImapTLS: true, passwordCompatibility: true, gracefulRestart: true, externalRealMailSent: false });
  console.log(JSON.stringify({ time: new Date().toISOString(), level: "INFO", event: "release.fixture.success", status: "success", prefix }));
} catch (error) {
  if (prepared) {
    let logs = compose("logs", "--no-color");
    for (const [key, value] of Object.entries(env)) if (/PASSWORD|SECRET/.test(key)) logs = logs.split(value).join("[REDACTED]");
    fs.writeFileSync(directory + "/reports/fixture-error.log", logs, { mode: 0o600 });
  }
  throw error;
} finally {
  if (prepared) { compose("stop", "--timeout", "60"); compose("rm", "-f"); }
  // Exact fixture names only; never uses down -v or global cleanup.
  for (const k of ["mail", "accounts", "queue", "auth", "data"]) {
    const volume = prefix + "-" + k;
    if (execFileSync("docker", ["volume", "ls", "--filter", "name=^" + volume + "$", "--format", "{{.Name}}"], { encoding: "utf8" }).trim() === volume) docker(["volume", "rm", volume]);
  }
  if (execFileSync("docker", ["network", "ls", "--filter", "name=^" + prefix + "$", "--format", "{{.Name}}"], { encoding: "utf8" }).trim() === prefix) docker(["network", "rm", prefix]);
  fs.rmSync(fixture, { recursive: true });
  save("fixture-cleanup.json", { status: "success", prefix, fixtureDataAndCredentialsRemoved: true });
}
