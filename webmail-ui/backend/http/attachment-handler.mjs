import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { auditLog } from "../shared/audit-logger.mjs";
import { requestContext } from "./request-context.mjs";
import { sendText } from "./responses.mjs";
export function createAttachmentHandler({ requestUserId, getAttachment }) {
  return async (req, res, pathname) => {
    const match = pathname.match(
      /^\/api\/mail\/([^/]+)\/([^/]+)\/attachments\/([^/]+)$/,
    );
    if (!match) return false;
    const [, box, id, attachmentId] = match,
      actor = requestUserId(req),
      startedAt = Date.now(),
      context = {
        ...requestContext(req, pathname),
        actor: actor || "anonymous",
        box,
        messageId: id,
        attachmentId,
      };
    try {
      const { attachment, filePath, stat } = await getAttachment({
        actor,
        box,
        id,
        attachmentId,
      });
      res.writeHead(200, {
        "Content-Type": attachment.contentType || "application/octet-stream",
        "Content-Length": stat.size,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      });
      await pipeline(createReadStream(filePath), res);
      auditLog("INFO", "mail.attachment.download", {
        ...context,
        status: 200,
        attachmentBytes: stat.size,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const status = error.status || 404;
      auditLog(
        status === 403 || status === 401 ? "WARN" : "ERROR",
        "mail.attachment.failure",
        { ...context, status, error, durationMs: Date.now() - startedAt },
      );
      if (!res.headersSent && !res.destroyed)
        sendText(
          res,
          status,
          status === 401
            ? "로그인이 필요합니다."
            : status === 403
              ? "이 첨부파일에 접근할 수 없습니다."
              : "첨부파일을 찾을 수 없습니다.",
        );
      else res.destroy();
    }
    return true;
  };
}
