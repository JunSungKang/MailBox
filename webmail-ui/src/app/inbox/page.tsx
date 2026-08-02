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
          <p className="eyebrow">Inbox</p>
          <h1>오늘 도착한 편지</h1>
          <p className="pageIntro">당신에게 닿은 이야기들을 천천히 열어보세요.</p>
        </div>
        <span className="countPill">{messages.length}통</span>
      </div>
      <section className="panel">
        {messages.length === 0 ? (
          <div className="empty"><span className="emptyIcon" aria-hidden="true">☁</span><strong>아직 도착한 편지가 없어요</strong><span>새 편지가 오면 이곳에 포근히 내려앉을 거예요.</span></div>
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
