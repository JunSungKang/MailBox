import Link from "next/link";
import { headers } from "next/headers";
import { auditInfo, requestContextFromHeaders } from "@/lib/auditLogger";
import { boxLabels, formatDate, listMessages } from "@/lib/mailStore";

export const dynamic = "force-dynamic";

export default async function BouncedPage() {
  const startedAt = Date.now();
  const messages = await listMessages("bounced");
  const requestHeaders = await headers();
  auditInfo("mail.list.view", {
    ...requestContextFromHeaders(requestHeaders, "GET", "/bounced"),
    box: "bounced",
    resultCount: messages.length,
    durationMs: Date.now() - startedAt
  });

  return (
    <>
      <div className="pageHeader">
        <h1>{boxLabels.bounced}</h1>
      </div>
      <section className="panel">
        {messages.length === 0 ? (
          <div className="empty">반송된 메일이 없습니다.</div>
        ) : (
          <div className="mailList">
            {messages.map((message) => (
              <Link className="mailRow" href={`/mail/bounced/${message.id}`} key={message.id}>
                <span className="sender">{message.from || "(보낸 사람 없음)"}</span>
                <span className="subject">{message.subject || "(제목 없음)"}</span>
                <span className="date">{formatDate(message.date)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
