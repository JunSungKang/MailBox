import type { MailMessage } from "../../../../backend/domain/mail-types";
export function messageDetailView(message: MailMessage) {
  const title = message.subject || "(제목 없음)";
  const replyQuery = new URLSearchParams({
    to: message.from,
    subject: message.subject.toLowerCase().startsWith("re:")
      ? message.subject
      : `Re: ${title}`,
  });
  return {
    title,
    replyHref: `/compose?${replyQuery.toString()}`,
    canReply: message.box !== "bounced" && !!message.from,
  };
}
