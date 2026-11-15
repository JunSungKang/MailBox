import MailboxPage from "@/features/mailbox/MailboxPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "보낸 편지" };
export default function Page() {
  return <MailboxPage box="sent" />;
}
