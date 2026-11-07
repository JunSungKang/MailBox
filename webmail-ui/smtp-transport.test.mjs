import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import tls from "node:tls";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createSubmissionTransport, submissionOptions, safeSmtpError } from "./smtp-transport.mjs";

test("submission requires authenticated, verified TLS without plaintext fallback", async (t) => {
  // Temporary keys stay under the checkout, including on developer machines.
  const directory = fs.mkdtempSync(path.join(process.cwd(), ".smtp-test-"));
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
