import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auditInfo, requestContextFromHeaders } from "@/lib/auditLogger";
import { currentUserId } from "@/lib/auth";
import { messageBelongsToUser } from "@/lib/mailAccess";
import { formatDate, listMessages } from "@/lib/mailStore";

export const dynamic = "force-dynamic";
export const metadata = { title: "보낸 편지" };

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
        <div>
          <p className="eyebrow">Outgoing signals · Sent</p>
          <h1>당신이 보낸 편지</h1>
          <p className="pageIntro">다음 이야기를 향해 보낸 마음들을 모았어요.</p>
        </div>
        <span className="countPill">{messages.length}통</span>
      </div>
      <section className="panel">
        {messages.length === 0 ? (
          <div className="empty"><span className="emptyIcon" aria-hidden="true">↗</span><strong>아직 보낸 편지가 없어요</strong><span>다음 이야기는 당신의 한마디로 시작해요.</span><Link className="softButton" href="/compose">편지 쓰기</Link></div>
        ) : (
          <div className="mailList">
            <div className="mailListHead" aria-hidden="true"><span>받는 사람</span><span>제목</span><span className="date">보낸 때</span></div>
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
