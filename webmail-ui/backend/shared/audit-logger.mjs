function serializeValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      code:
        typeof value.code === "string" && /^[A-Z_]{1,40}$/.test(value.code)
          ? value.code
          : "INTERNAL_ERROR",
    };
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)]),
    );
  }
  return value;
}
function serializeAuditRecord(record) {
  return JSON.stringify(serializeValue(record));
}
export function auditLog(level, event, fields = {}) {
  const record = {
    time: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = serializeAuditRecord(record);
  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.info(line);
  }
}
export function auditInfo(event, fields = {}) {
  auditLog("INFO", event, fields);
}
export function auditWarn(event, fields = {}) {
  auditLog("WARN", event, fields);
}
export function auditError(event, fields = {}) {
  auditLog("ERROR", event, fields);
}
export function requestContextFromHeaders(headers, method, path, actor) {
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const ip =
    forwardedFor.split(",")[0]?.trim() || headers.get("x-real-ip") || undefined;
  return {
    requestId: headers.get("x-request-id") || undefined,
    actor: actor || "anonymous",
    ip,
    userAgent: headers.get("user-agent") || undefined,
    method,
    path,
  };
}
