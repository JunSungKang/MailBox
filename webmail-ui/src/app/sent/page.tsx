import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auditInfo, requestContextFromHeaders } from "@/lib/auditLogger";
import { currentUserId } from "@/lib/auth";
import { messageBelongsToUser } from "@/lib/mailAccess";
import { boxLabels, formatDate, listMessages } from "@/lib/mailStore";

export const dynamic = "force-dynamic";

export default async function SentPage() {
  const startedAt = Date.now();
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const messages = (await listMessages("sent")).filter((message) => messageBelongsToUser(message, userId));
  const requestHeaders = await headers();
  auditInfo("mail.list.view", {
    ...requestContextFromHeaders(requestHeaders, "GET", "/sent", userId),
    box: "sent",
    resultCount: messages.length,
    durationMs: Date.now() - startedAt
  });

  return (
    <>
      <div className="pageHeader">
        <h1>{boxLabels.sent}</h1>
      </div>
      <section className="panel">
        {messages.length === 0 ? (
          <div className="empty">메일이 없습니다.</div>
        ) : (
          <div className="mailList">
            {messages.map((message) => (
              <Link className="mailRow" href={`/mail/sent/${message.id}`} key={message.id}>
                <span className="sender">{message.to.join(", ") || "(받는 사람 없음)"}</span>
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
