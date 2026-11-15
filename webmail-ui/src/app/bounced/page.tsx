import MailboxPage from "@/features/mailbox/MailboxPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "돌아온 편지" };
export default function Page() {
  return <MailboxPage box="bounced" />;
}
