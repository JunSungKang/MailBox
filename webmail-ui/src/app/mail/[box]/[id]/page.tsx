import { messageDetailView } from "@/features/message/model/message-detail-view";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import {
  auditInfo,
  auditWarn,
  requestContextFromHeaders,
} from "@/lib/auditLogger";
import { currentUserId } from "@/lib/auth";
import { messageBelongsToUser } from "@/lib/mailAccess";
import { boxLabels, isMailBox } from "@/lib/mailStore";
import MessageHeader from "@/features/message/components/MessageHeader";
import MessageBody from "@/features/message/components/MessageBody";
import { mailboxService } from "@/server/services";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    box: string;
    id: string;
  }>;
};

export default async function MailDetailPage({ params }: PageProps) {
  const startedAt = Date.now();
  const { box, id } = await params;
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const requestHeaders = await headers();
  if (!isMailBox(box)) {
    auditWarn("mail.detail.invalid_box", {
      ...requestContextFromHeaders(requestHeaders, "GET", `/mail/${box}/${id}`),
      box,
      messageId: id,
      durationMs: Date.now() - startedAt,
    });
    notFound();
  }

  const message = await mailboxService.getMessage({ actor: userId, box, id });
  if (!message) {
    auditWarn("mail.detail.not_found", {
      ...requestContextFromHeaders(requestHeaders, "GET", `/mail/${box}/${id}`),
      box,
      messageId: id,
      durationMs: Date.now() - startedAt,
    });
    notFound();
  }

  if (!messageBelongsToUser(message, userId)) {
    auditWarn("mail.detail.forbidden", {
      ...requestContextFromHeaders(
        requestHeaders,
        "GET",
        `/mail/${box}/${id}`,
        userId,
      ),
      box,
      messageId: id,
      durationMs: Date.now() - startedAt,
    });
    notFound();
  }

  auditInfo("mail.detail.view", {
    ...requestContextFromHeaders(
      requestHeaders,
      "GET",
      `/mail/${box}/${id}`,
      userId,
    ),
    box,
    messageId: message.id,
    attachmentCount: message.attachments.length,
    durationMs: Date.now() - startedAt,
  });

  const view = messageDetailView(message);

  return (
    <div className="message">
      <div className="messageToolbar">
        <Link className="textLink" href={`/${box}`}>
          ← {boxLabels[box]}으로
        </Link>
        <div className="messageActions">
          {view.canReply ? (
            <Link className="softButton" href={view.replyHref}>
              답장하기
            </Link>
          ) : null}
        </div>
      </div>
      <MessageHeader message={message} />
      <MessageBody message={message} />
    </div>
  );
}
