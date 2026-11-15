import { formatBytes } from "@/shared/format";
import type { MailMessage } from "../../../../backend/domain/mail-types";
export default function AttachmentList({ message }: { message: MailMessage }) {
  const box = message.box;
  return (
    <>
      {message.attachments.length > 0 ? (
        <div className="attachments">
          <h2 className="attachmentsTitle">
            첨부파일 {message.attachments.length}개
          </h2>
          {message.attachments.map((attachment) => (
            <a
              className="attachmentLink"
              href={`/api/mail/${box}/${message.id}/attachments/${attachment.id}`}
              key={attachment.id}
            >
              <span>{attachment.filename}</span>
              <span className="muted">{formatBytes(attachment.size)}</span>
            </a>
          ))}
        </div>
      ) : null}
    </>
  );
}
