import type { MailMeta } from "../../../../backend/domain/mail-types";
import { formatDate } from "@/shared/format";
export type MailRowView = {
  id: string;
  href: string;
  party: string;
  subject: string;
  date: string;
};
export function mailListView(messages: MailMeta[]): MailRowView[] {
  return messages.map((message) => ({
    id: message.id,
    href: `/mail/${message.box}/${encodeURIComponent(message.id)}`,
    party:
      message.box === "sent"
        ? message.to.join(", ") || "(받는 사람 없음)"
        : message.from || "(보낸 사람 없음)",
    subject: message.subject || "(제목 없음)",
    date: formatDate(message.date),
  }));
}
