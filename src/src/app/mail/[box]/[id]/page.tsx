import { notFound } from "next/navigation";
import {
  boxLabels,
  formatBytes,
  formatDate,
  isMailBox,
  readMessage
} from "@/lib/mailStore";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    box: string;
    id: string;
  }>;
};

export default async function MailDetailPage({ params }: PageProps) {
  const { box, id } = await params;
  if (!isMailBox(box)) notFound();

  const message = await readMessage(box, id);
  if (!message) notFound();

  return (
    <div className="message">
      <section className="panel messageHead">
        <p className="muted">{boxLabels[box]}</p>
        <h1>{message.subject || "(제목 없음)"}</h1>
        <div className="messageMeta">
          <div>보낸 사람: {message.from || "-"}</div>
          <div>받는 사람: {message.to.join(", ") || "-"}</div>
          <div>날짜: {formatDate(message.date)}</div>
        </div>
        {message.delivery && !message.delivery.ok ? (
          <p className="status error">{message.delivery.detail || "발송 실패"}</p>
        ) : null}
      </section>
      <section className="panel">
        <div
          className="messageBody"
          dangerouslySetInnerHTML={{
            __html: message.bodyHtml || message.bodyText.replace(/\r?\n/g, "<br />")
          }}
        />
        {message.attachments.length > 0 ? (
          <div className="attachments">
            {message.attachments.map((attachment) => (
              <a
                className="attachmentLink"
                href={`/api/mail/${box}/${message.id}/attachments/${attachment.id}`}
                key={attachment.id}
              >
                <span>{attachment.filename}</span>
                <span className="muted">{formatBytes(attachment.size)}</span>
              </a>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
