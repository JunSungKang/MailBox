import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUserId } from "@/server/session";
import { mailboxService } from "@/server/services";
import { auditInfo, requestContextFromHeaders } from "@/lib/auditLogger";
import { mailListView } from "./model/mail-list-view";
import MailboxView from "./components/MailboxView";
import type { MailBox } from "../../../backend/domain/mail-types";
export default async function MailboxPage({ box }: { box: MailBox }) {
  const startedAt = Date.now(),
    actor = await currentUserId();
  if (!actor) redirect("/login");
  const messages = await mailboxService.listMailbox({ actor, box });
  auditInfo("mail.list.view", {
    ...requestContextFromHeaders(await headers(), "GET", `/${box}`, actor),
    box,
    resultCount: messages.length,
    durationMs: Date.now() - startedAt,
  });
  return <MailboxView box={box} rows={mailListView(messages)} />;
}
