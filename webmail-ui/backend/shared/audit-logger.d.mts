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
export declare function auditLog(
  level: AuditLevel,
  event: string,
  fields?: AuditFields,
): void;
export declare function auditInfo(event: string, fields?: AuditFields): void;
export declare function auditWarn(event: string, fields?: AuditFields): void;
export declare function auditError(event: string, fields?: AuditFields): void;
export declare function requestContextFromHeaders(
  headers: Headers,
  method: string,
  path: string,
  actor?: string,
): AuditContext;
export {};
