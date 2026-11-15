import crypto from "node:crypto";
export function requestContext(req, pathOverride) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor || "").split(",")[0].trim() || req.headers["x-real-ip"];
  return {
    requestId: req.headers["x-request-id"] || crypto.randomUUID(),
    actor: "anonymous",
    ip,
    userAgent: req.headers["user-agent"],
    method: req.method,
    path: pathOverride || req.url || "",
  };
}
