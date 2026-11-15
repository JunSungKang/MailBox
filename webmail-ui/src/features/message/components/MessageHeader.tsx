import { boxLabels } from "@/lib/mailStore";
import { formatDate } from "@/shared/format";
import StatusMessage from "@/components/ui/StatusMessage";
import type { MailMessage } from "../../../../backend/domain/mail-types";
export default function MessageHeader({ message }: { message: MailMessage }) {
  const box = message.box,
    messageTitle = message.subject || "(제목 없음)";
  return (
    <section className="panel messageHead">
      <p className="eyebrow">{boxLabels[box]}</p>
      <h1>{messageTitle}</h1>
      <div className="messageMeta">
        <div>
          <strong>보낸 사람</strong> {message.from || "-"}
        </div>
        <div>
          <strong>받는 사람</strong> {message.to.join(", ") || "-"}
        </div>
        <div>
          <strong>날짜</strong> {formatDate(message.date)}
        </div>
      </div>
      {message.delivery && !message.delivery.ok ? (
        <StatusMessage>{message.delivery.detail || "발송 실패"}</StatusMessage>
      ) : null}
    </section>
  );
}
