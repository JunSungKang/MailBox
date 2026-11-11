import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import tls from "node:tls";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createSubmissionTransport, submissionOptions, safeSmtpError } from "./smtp-transport.mjs";
import { ensureSubmissionAccount } from "./smtp-bootstrap.mjs";

test("standard submission defaults to 587 and explicit legacy 2587 remains selectable", () => {
  const env = { SMTP_HOST: "fixture.test", SMTP_TLS_SERVERNAME: "fixture.test", SMTP_AUTH_USER: "fixture-service", SMTP_AUTH_PASSWORD: "x".repeat(48) };
  assert.equal(submissionOptions(env).port, 587);
  assert.equal(submissionOptions({ ...env, SMTP_SUBMISSION_PORT: "2587" }).port, 2587);
});

test("bootstrap verifies existing long credentials without reapplying signup policy", async () => {
  const env = { SMTP_AUTH_USER: "existing-service", SMTP_AUTH_PASSWORD: "x".repeat(80) };
  let verified = 0;
  await ensureSubmissionAccount({ env, verify: async () => { verified += 1; },
    fetchImpl: async () => { throw new Error("Existing credentials must not trigger signup"); } });
  assert.equal(verified, 1);
});

test("bootstrap provisions only after an authentication failure and verifies again", async () => {
  let verified = 0;
  let signups = 0;
  await ensureSubmissionAccount({ env: { SMTP_AUTH_USER: "new-service", SMTP_AUTH_PASSWORD: "x".repeat(48), WEBMAIL_SIGNUP_TOKEN: "fixture-invite" },
    verify: async () => { if (++verified === 1) throw Object.assign(new Error("fixture auth failure"), { code: "EAUTH" }); },
    fetchImpl: async (_url, options) => {
      signups += 1;
      assert.equal(options.redirect, "manual");
      assert.equal(options.body.get("userId"), "new-service");
      return new Response(null, { status: 303, headers: { location: "/inbox" } });
    } });
  assert.equal(signups, 1);
  assert.equal(verified, 2);
});

test("bootstrap never signs up after TLS or network failure", async () => {
  for (const code of ["ETLS", "ESOCKET", "ECONNECTION"]) {
    await assert.rejects(ensureSubmissionAccount({ verify: async () => { throw Object.assign(new Error("fixture connection failure"), { code }); },
      fetchImpl: async () => assert.fail("TLS/network failure must not provision accounts") }), { code });
  }
});

test("bootstrap rejects wrong existing credentials even if signup says account exists", async () => {
  let verified = 0;
  await assert.rejects(ensureSubmissionAccount({ verify: async () => { verified += 1; throw Object.assign(new Error("fixture auth failure"), { code: "EAUTH" }); },
    fetchImpl: async () => new Response(null, { status: 303, headers: { location: "/signup?error=exists" } }) }), { code: "EAUTH" });
  assert.equal(verified, 2);
});

test("submission requires authenticated, verified TLS without plaintext fallback", async (t) => {
  // Temporary keys stay under the checkout, including on developer machines.
  const directory = fs.mkdtempSync(path.join(process.env.MAILBOX_TEST_TMP || process.cwd(), ".smtp-test-"));
  const key = path.join(directory, "key.pem");
  const cert = path.join(directory, "cert.pem");
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=submission.test",
      "-addext", "subjectAltName=DNS:submission.test"], { stdio: "ignore" });
    const context = tls.createSecureContext({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) });
    for (const mode of ["valid", "no-starttls", "broken-handshake", "untrusted", "wrong-host"]) {
      await t.test(mode, async () => {
        const commands = [];
        const sockets = new Set();
        const server = net.createServer((initial) => {
          sockets.add(initial);
          initial.on("error", () => {});
          initial.write("220 fixture ESMTP\r\n");
          const attach = (socket, encrypted) => {
            let buffer = "";
            let data = false;
            const onData = (chunk) => {
              buffer += chunk.toString();
              while (buffer.includes("\r\n")) {
                const end = buffer.indexOf("\r\n");
                const line = buffer.slice(0, end);
                buffer = buffer.slice(end + 2);
                const command = line.split(" ")[0].toUpperCase();
                if (data) {
                  if (line === ".") { data = false; socket.write("250 queued\r\n"); }
                  continue;
                }
                commands.push({ command, encrypted });
                if (command === "EHLO") {
                  socket.write(`250-fixture\r\n${encrypted ? "250-AUTH PLAIN\r\n" : mode === "no-starttls" ? "" : "250-STARTTLS\r\n"}250 SIZE 100000\r\n`);
                } else if (command === "STARTTLS") {
                  if (mode === "no-starttls") { socket.write("502 unsupported\r\n"); continue; }
                  socket.write("220 TLS ready\r\n");
                  if (mode === "broken-handshake") { socket.destroy(); return; }
                  socket.removeListener("data", onData);
                  const secure = new tls.TLSSocket(socket, { isServer: true, secureContext: context });
                  sockets.add(secure);
                  secure.on("error", () => {});
                  attach(secure, true);
                  return;
                } else if (command === "AUTH") socket.write("235 authenticated\r\n");
                else if (command === "MAIL" || command === "RCPT") socket.write("250 accepted\r\n");
                else if (command === "DATA") { data = true; socket.write("354 continue\r\n"); }
                else if (command === "QUIT") socket.end("221 bye\r\n");
                else socket.write("250 OK\r\n");
              }
            };
            socket.on("data", onData);
          };
          attach(initial, false);
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const password = crypto.randomBytes(32).toString("base64url");
        const env = { SMTP_HOST: "127.0.0.1", SMTP_SUBMISSION_PORT: String(server.address().port),
          SMTP_TLS_SERVERNAME: mode === "wrong-host" ? "wrong.test" : "submission.test",
          SMTP_AUTH_USER: "fixture", SMTP_AUTH_PASSWORD: password,
          ...(mode === "untrusted" ? {} : { SMTP_TLS_CA_FILE: cert }) };
        const transport = createSubmissionTransport(env);
        try {
          const operation = transport.sendMail({ from: "sender@fixture.test", to: "recipient@fixture.test", text: "fixture" });
          if (mode === "valid") {
            await operation;
            assert(commands.some((entry) => entry.command === "AUTH" && entry.encrypted));
            assert(commands.some((entry) => entry.command === "DATA" && entry.encrypted));
            await ensureSubmissionAccount({ env: { ...env, SMTP_AUTH_PASSWORD: "x".repeat(80) },
              fetchImpl: async () => assert.fail("Verified existing service must not trigger signup") });
          } else {
            await assert.rejects(operation);
            assert(!commands.some((entry) => ["AUTH", "MAIL", "RCPT", "DATA"].includes(entry.command)));
          }
          assert(!commands.some((entry) => ["AUTH", "DATA"].includes(entry.command) && !entry.encrypted));
          assert(!JSON.stringify(safeSmtpError({ code: "EAUTH", message: password, response: password })).includes(password));
          assert.throws(() => submissionOptions({ ...env, SMTP_URL: "smtp://legacy" }));
          assert.throws(() => submissionOptions({ ...env, SMTP_AUTH_PASSWORD: "short" }));
        } finally {
          transport.close();
          for (const socket of sockets) socket.destroy();
          await new Promise((resolve) => server.close(resolve));
        }
      });
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
