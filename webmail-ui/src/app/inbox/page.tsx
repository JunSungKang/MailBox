import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auditInfo, requestContextFromHeaders } from "@/lib/auditLogger";
import { currentUserId } from "@/lib/auth";
import { messageBelongsToUser } from "@/lib/mailAccess";
import { formatDate, listMessages } from "@/lib/mailStore";

export const dynamic = "force-dynamic";
export const metadata = { title: "받은 편지" };

export default async function InboxPage() {
  const startedAt = Date.now();
  const signedInUserId = await currentUserId();
  if (!signedInUserId) redirect("/login");
  const messages = (await listMessages("inbox")).filter((message) => messageBelongsToUser(message, signedInUserId));
  const requestHeaders = await headers();
  auditInfo("mail.list.view", {
    ...requestContextFromHeaders(requestHeaders, "GET", "/inbox", signedInUserId),
    box: "inbox",
    filterType: "signedInUser",
    resultCount: messages.length,
    durationMs: Date.now() - startedAt
  });

  return (
    <>
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Incoming signals · Inbox</p>
          <h1>당신에게 도착한 편지</h1>
          <p className="pageIntro">작은 신호 하나가 새로운 이야기를 열어줄 거예요.</p>
        </div>
        <span className="countPill">{messages.length}통</span>
      </div>
      <section className="panel">
        {messages.length === 0 ? (
          <div className="empty"><span className="emptyIcon" aria-hidden="true">◎</span><strong>새로운 이야기가 시작될 곳</strong><span>새 편지가 도착하면 이곳에서 열어볼 수 있어요.</span></div>
        ) : (
          <div className="mailList">
            <div className="mailListHead" aria-hidden="true"><span>보낸 사람</span><span>제목</span><span className="date">도착한 때</span></div>
            {messages.map((message) => (
              <Link className="mailRow" href={`/mail/inbox/${message.id}`} key={message.id}>
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
