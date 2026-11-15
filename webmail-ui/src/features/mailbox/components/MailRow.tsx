import Link from "next/link";
import type { MailRowView } from "../model/mail-list-view";
export default function MailRow({ row }: { row: MailRowView }) {
  return (
    <Link className="mailRow" href={row.href}>
      <span className="sender">{row.party}</span>
      <span className="subject">{row.subject}</span>
      <span className="date">{row.date}</span>
    </Link>
  );
}
