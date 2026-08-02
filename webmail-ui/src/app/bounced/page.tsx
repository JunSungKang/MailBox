import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auditInfo, requestContextFromHeaders } from "@/lib/auditLogger";
import { currentUserId } from "@/lib/auth";
import { messageBelongsToUser } from "@/lib/mailAccess";
import { formatDate, listMessages } from "@/lib/mailStore";

export const dynamic = "force-dynamic";
export const metadata = { title: "돌아온 편지" };

export default async function BouncedPage() {
  const startedAt = Date.now();
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const messages = (await listMessages("bounced")).filter((message) => messageBelongsToUser(message, userId));
  const requestHeaders = await headers();
  auditInfo("mail.list.view", {
    ...requestContextFromHeaders(requestHeaders, "GET", "/bounced", userId),
    box: "bounced",
    resultCount: messages.length,
    durationMs: Date.now() - startedAt
  });

  return (
    <>
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Returned</p>
          <h1>돌아온 편지</h1>
          <p className="pageIntro">전달되지 못하고 돌아온 편지와 이유를 확인하세요.</p>
        </div>
        <span className="countPill">{messages.length}통</span>
      </div>
      <section className="panel">
        {messages.length === 0 ? (
          <div className="empty"><span className="emptyIcon" aria-hidden="true">◌</span><strong>돌아온 편지가 없어요</strong><span>모든 편지가 무사히 길을 찾고 있어요.</span></div>
        ) : (
          <div className="mailList">
            <div className="mailListHead" aria-hidden="true"><span>보낸 사람</span><span>제목</span><span className="date">돌아온 때</span></div>
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
