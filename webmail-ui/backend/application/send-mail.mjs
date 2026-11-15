import { randomUUID } from "node:crypto";
import { safeSmtpError } from "../infrastructure/smtp/submission-adapter.mjs";
export function createSendMail({ repository, transport, domain, audit }) {
  return async function sendMail({ actor, fields, uploaded, context = {} }) {
    const startedAt = Date.now();
    if (!actor)
      throw Object.assign(Error("Authentication required"), { status: 401 });
    const to = fields.to
      .split(/[,\n;]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => (value.includes("@") ? value : `${value}@${domain}`));
    if (!to.length)
      throw Object.assign(Error("받는 사람을 입력해야 합니다."), {
        status: 400,
      });
    const id = randomUUID(),
      attachments = await repository.stage(id, uploaded),
      body = fields.body || "";
    const meta = {
      id,
      box: "sent",
      from: `${actor}@${domain}`,
      to,
      subject: fields.subject || "",
      date: new Date().toISOString(),
      attachments: attachments.map(({ path, ...item }) => item),
    };
    try {
      await transport.sendMail({
        from: meta.from,
        to: to.join(", "),
        subject: meta.subject || "(제목 없음)",
        text: body,
        attachments: attachments.map((item) => ({
          filename: item.filename,
          contentType: item.contentType,
          path: item.path,
        })),
      });
      meta.delivery = {
        attempted: true,
        ok: true,
        detail: "Postfix 접수 완료",
      };
    } catch (error) {
      meta.delivery = {
        attempted: true,
        ok: false,
        detail:
          "보안 SMTP 제출에 실패했습니다. 연결 및 인증 설정을 확인하세요.",
      };
      audit("ERROR", "mail.send.smtp_failure", {
        ...context,
        messageId: id,
        error: safeSmtpError(error),
        recipientCount: to.length,
      });
    }
    // SMTP acceptance and filesystem persistence are separate outcomes. Never retry here.
    try {
      await repository.persist(meta, body);
    } catch (error) {
      audit("ERROR", "mail.send.storage_failure", {
        ...context,
        messageId: id,
        deliveryAccepted: meta.delivery.ok,
      });
      throw error;
    }
    audit(
      meta.delivery.ok ? "INFO" : "WARN",
      meta.delivery.ok ? "mail.send.success" : "mail.send.delivery_unavailable",
      {
        ...context,
        messageId: id,
        recipientCount: to.length,
        attachmentCount: attachments.length,
        attachmentBytes: attachments.reduce((sum, item) => sum + item.size, 0),
        durationMs: Date.now() - startedAt,
        deliveryAttempted: true,
        deliveryOk: meta.delivery.ok,
      },
    );
    return meta;
  };
}
