import MailHtmlFrame from "./MailHtmlFrame";
import AttachmentList from "./AttachmentList";
import { textToHtml } from "@/lib/text";
import type { MailMessage } from "../../../../backend/domain/mail-types";
export default function MessageBody({ message }: { message: MailMessage }) {
  const hasHtmlBody = message.bodyHtml.trim().length > 0,
    messageTitle = message.subject || "(제목 없음)";
  return (
    <section className="panel messageBody">
      {hasHtmlBody ? (
        <MailHtmlFrame html={message.bodyHtml} title={`${messageTitle} 본문`} />
      ) : (
        <div
          className="messageTextBody"
          dangerouslySetInnerHTML={{
            __html: textToHtml(message.bodyText),
          }}
        />
      )}
      <AttachmentList message={message} />
    </section>
  );
}
