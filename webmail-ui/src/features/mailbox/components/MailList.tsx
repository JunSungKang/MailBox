import MailRow from "./MailRow";
import type { MailRowView } from "../model/mail-list-view";
export default function MailList({
  rows,
  partyLabel,
  dateLabel,
}: {
  rows: MailRowView[];
  partyLabel: string;
  dateLabel: string;
}) {
  return (
    <div className="mailList">
      <div className="mailListHead" aria-hidden="true">
        <span>{partyLabel}</span>
        <span>제목</span>
        <span className="date">{dateLabel}</span>
      </div>
      {rows.map((row) => (
        <MailRow key={row.id} row={row} />
      ))}
    </div>
  );
}
