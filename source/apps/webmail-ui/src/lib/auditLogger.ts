export type AuditLevel = "INFO" | "WARN" | "ERROR";

type AuditContext = {
  requestId?: string;
  actor?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
};

type AuditFields = Record<string, unknown>;

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)])
    );
  }
  return value;
}

function serializeAuditRecord(record: AuditFields): string {
  return JSON.stringify(serializeValue(record));
}

export function auditLog(level: AuditLevel, event: string, fields: AuditFields = {}): void {
  const record = {
    time: new Date().toISOString(),
    level,
    event,
    ...fields
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

export function auditInfo(event: string, fields: AuditFields = {}): void {
  auditLog("INFO", event, fields);
}

export function auditWarn(event: string, fields: AuditFields = {}): void {
  auditLog("WARN", event, fields);
}

export function auditError(event: string, fields: AuditFields = {}): void {
  auditLog("ERROR", event, fields);
}

export function requestContextFromHeaders(
  headers: Headers,
  method: string,
  path: string,
  actor?: string
): AuditContext {
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0]?.trim() || headers.get("x-real-ip") || undefined;
  return {
    requestId: headers.get("x-request-id") || undefined,
    actor: actor || "anonymous",
    ip,
    userAgent: headers.get("user-agent") || undefined,
    method,
    path
  };
}
