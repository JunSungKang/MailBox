import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auditInfo, auditWarn, requestContextFromHeaders } from "@/lib/auditLogger";
import { currentUserId } from "@/lib/auth";
import { messageBelongsToUser } from "@/lib/mailAccess";
import {
  boxLabels,
  formatBytes,
  formatDate,
  isMailBox,
  readMessage
} from "@/lib/mailStore";
import { textToHtml } from "@/lib/text";
import MailHtmlFrame from "./MailHtmlFrame";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    box: string;
    id: string;
  }>;
};

export default async function MailDetailPage({ params }: PageProps) {
  const startedAt = Date.now();
  const { box, id } = await params;
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const requestHeaders = await headers();
  if (!isMailBox(box)) {
    auditWarn("mail.detail.invalid_box", {
      ...requestContextFromHeaders(requestHeaders, "GET", `/mail/${box}/${id}`),
      box,
      messageId: id,
      durationMs: Date.now() - startedAt
    });
    notFound();
  }

  const message = await readMessage(box, id);
  if (!message) {
    auditWarn("mail.detail.not_found", {
      ...requestContextFromHeaders(requestHeaders, "GET", `/mail/${box}/${id}`),
      box,
      messageId: id,
      durationMs: Date.now() - startedAt
    });
    notFound();
  }

  if (!messageBelongsToUser(message, userId)) {
    auditWarn("mail.detail.forbidden", {
      ...requestContextFromHeaders(requestHeaders, "GET", `/mail/${box}/${id}`, userId),
      box,
      messageId: id,
      durationMs: Date.now() - startedAt
    });
    notFound();
  }

  auditInfo("mail.detail.view", {
    ...requestContextFromHeaders(requestHeaders, "GET", `/mail/${box}/${id}`, userId),
    box,
    messageId: message.id,
    attachmentCount: message.attachments.length,
    durationMs: Date.now() - startedAt
  });

  const hasHtmlBody = message.bodyHtml.trim().length > 0;
  const messageTitle = message.subject || "(제목 없음)";
  const replyQuery = new URLSearchParams({
    to: message.from,
    subject: message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${messageTitle}`
  });

  return (
    <div className="message">
      <div className="messageToolbar">
        <Link className="textLink" href={`/${box}`}>← {boxLabels[box]}으로</Link>
        <div className="messageActions">
          {box !== "bounced" && message.from ? <Link className="softButton" href={`/compose?${replyQuery.toString()}`}>답장하기</Link> : null}
        </div>
      </div>
      <section className="panel messageHead">
        <p className="eyebrow">{boxLabels[box]}</p>
        <h1>{messageTitle}</h1>
        <div className="messageMeta">
          <div><strong>보낸 사람</strong> {message.from || "-"}</div>
          <div><strong>받는 사람</strong> {message.to.join(", ") || "-"}</div>
          <div><strong>날짜</strong> {formatDate(message.date)}</div>
        </div>
        {message.delivery && !message.delivery.ok ? (
          <p className="status error">{message.delivery.detail || "발송 실패"}</p>
        ) : null}
      </section>
      <section className="panel messageBody">
        {hasHtmlBody ? (
          <MailHtmlFrame html={message.bodyHtml} title={`${messageTitle} 본문`} />
        ) : (
          <div
            className="messageTextBody"
            dangerouslySetInnerHTML={{
              __html: textToHtml(message.bodyText)
            }}
          />
        )}
        {message.attachments.length > 0 ? (
          <div className="attachments">
            <h2 className="attachmentsTitle">첨부파일 {message.attachments.length}개</h2>
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
