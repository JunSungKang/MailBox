import { createRouter } from "./backend/http/router.mjs";
import http from "node:http";
import crypto from "node:crypto";
import next from "next";
import { createServices } from "./backend/bootstrap/create-services.mjs";
import { auditLog, auditError } from "./backend/shared/audit-logger.mjs";
const services = createServices();
const { dev, DATA_DIR } = services.config;
const hostname = process.env.BIND_HOST || "0.0.0.0",
  port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port }),
  handle = app.getRequestHandler();
await services.prepare();
await app.prepare();
const server = http
  .createServer(createRouter(services, handle))
  .listen(port, hostname, () => {
    auditLog("INFO", "server.start", {
      hostname,
      port,
      nodeEnv: process.env.NODE_ENV || "development",
      dataDir: DATA_DIR,
    });
  });

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  const startedAt = Date.now();
  const context = {
    requestId: crypto.randomUUID(),
    actor: "system",
    method: "SIGNAL",
    path: "server",
    signal,
  };
  auditLog("INFO", "server.shutdown.start", { ...context, status: "draining" });
  const deadline = setTimeout(() => {
    auditLog("ERROR", "server.shutdown.timeout", {
      ...context,
      status: "failed",
      durationMs: Date.now() - startedAt,
    });
    process.exit(1);
  }, 55_000);
  try {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await app.close();
    clearTimeout(deadline);
    auditLog("INFO", "server.shutdown.success", {
      ...context,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
    process.exit(0);
  } catch (error) {
    clearTimeout(deadline);
    auditError("server.shutdown.failure", {
      ...context,
      status: "failed",
      error,
      durationMs: Date.now() - startedAt,
    });
    process.exit(1);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
