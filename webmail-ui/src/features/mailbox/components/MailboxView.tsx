import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import MailList from "./MailList";
import { mailboxConfig } from "../model/mailbox-config";
import type { MailRowView } from "../model/mail-list-view";
import type { MailBox } from "../../../../backend/domain/mail-types";
export default function MailboxView({
  box,
  rows,
}: {
  box: MailBox;
  rows: MailRowView[];
}) {
  const c = mailboxConfig[box];
  return (
    <>
      <PageHeader
        {...c}
        trailing={<span className="countPill">{rows.length}통</span>}
      />
      <section className="panel">
        {rows.length ? (
          <MailList
            rows={rows}
            partyLabel={c.partyLabel}
            dateLabel={c.dateLabel}
          />
        ) : (
          <EmptyState
            icon={c.icon}
            title={c.emptyTitle}
            description={c.emptyDescription}
            action={
              box === "sent" ? (
                <Link className="softButton" href="/compose">
                  편지 쓰기
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </>
  );
}
