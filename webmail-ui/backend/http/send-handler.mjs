import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { multipartUpload } from "./multipart-upload.mjs";
import { requestContext } from "./request-context.mjs";
import { redirect, sendText } from "./responses.mjs";
import { auditLog } from "../shared/audit-logger.mjs";
export function createSendHandler({
  config,
  requestUserId,
  ensureDirs,
  sendMail,
}) {
  return async (req, res) => {
    const startedAt = Date.now(),
      actor = requestUserId(req),
      context = {
        ...requestContext(req, "/api/send"),
        actor: actor || "anonymous",
      };
    if (!actor) {
      auditLog("WARN", "mail.send.unauthorized", { ...context, status: 401 });
      redirect(res, "/login");
      return;
    }
    if (
      !String(req.headers["content-type"] || "").includes("multipart/form-data")
    ) {
      auditLog("WARN", "mail.send.invalid_content_type", {
        ...context,
        status: 415,
      });
      sendText(res, 415, "multipart/form-data 요청만 지원합니다.");
      return;
    }
    const temporary = path.join(config.TMP_ROOT, randomUUID());
    try {
      await ensureDirs();
      await fs.mkdir(temporary);
      const { fields, attachments } = await multipartUpload(
        req,
        temporary,
        config.MAX_ATTACHMENT_BYTES,
      );
      const meta = await sendMail({
        actor,
        fields,
        uploaded: attachments,
        context,
      });
      redirect(res, `/mail/sent/${meta.id}`);
    } catch (error) {
      const status = error.status || 500;
      auditLog(status < 500 ? "WARN" : "ERROR", "mail.send.rejected", {
        ...context,
        status,
        durationMs: Date.now() - startedAt,
      });
      if (!res.destroyed && !res.writableEnded)
        sendText(
          res,
          status,
          status < 500 ? error.message : "메일을 저장할 수 없습니다.",
        );
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
  };
}
