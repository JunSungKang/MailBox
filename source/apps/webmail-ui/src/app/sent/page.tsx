import Link from "next/link";
import { boxLabels, formatDate, listMessages } from "@/lib/mailStore";

export const dynamic = "force-dynamic";

export default async function SentPage() {
  const messages = await listMessages("sent");

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
