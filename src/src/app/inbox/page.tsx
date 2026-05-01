import Link from "next/link";
import { boxLabels, formatDate, listMessages } from "@/lib/mailStore";

export const dynamic = "force-dynamic";

type InboxPageProps = {
  searchParams: Promise<{
    mailId?: string | string[];
  }>;
};

function normalizeMailId(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return (rawValue || "").trim().toLowerCase();
}

function recipientMatches(recipient: string, mailIdFilter: string): boolean {
  const recipientText = recipient.toLowerCase();
  if (mailIdFilter.includes("@")) {
    return recipientText.includes(mailIdFilter);
  }

  const addresses = recipientText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
  if (addresses.length === 0) {
    return recipientText.includes(mailIdFilter);
  }

  return addresses.some((address) => address.split("@")[0] === mailIdFilter);
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const { mailId } = await searchParams;
  const mailIdFilter = normalizeMailId(mailId);
  const messages = (await listMessages("inbox")).filter((message) => {
    if (!mailIdFilter) return false;
    return message.to.some((recipient) => recipientMatches(recipient, mailIdFilter));
  });

  return (
    <>
      <div className="pageHeader">
        <h1>{boxLabels.inbox}</h1>
      </div>
      <section className="panel">
        <form className="mailSearch" action="/inbox">
          <label className="mailSearchLabel" htmlFor="mailId">
            메일 아이디
          </label>
          <input
            id="mailId"
            name="mailId"
            type="text"
            defaultValue={mailIdFilter}
            placeholder="jskang 또는 jskang@domain.com"
            autoComplete="email"
          />
          <button className="button" type="submit">
            조회
          </button>
        </form>
        {!mailIdFilter ? (
          <div className="empty">메일을 조회할 계정을 입력해주세요.</div>
        ) : messages.length === 0 ? (
          <div className="empty">메일이 없습니다.</div>
        ) : (
          <div className="mailList">
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
