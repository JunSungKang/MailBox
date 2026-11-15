import { promises as fs } from "node:fs";
import path from "node:path";
import { safeSegment } from "../shared/safe-path.mjs";
import { messageBelongsToUser } from "../domain/mail-access.mjs";
const fail = (status) =>
  Object.assign(Error("Attachment unavailable"), { status });
export function createAttachmentService({ root, io = fs }) {
  return async ({ actor, box, id, attachmentId }) => {
    if (!actor) throw fail(401);
    if (!["inbox", "sent", "bounced"].includes(box)) throw fail(404);
    const directory = path.join(root, box, safeSegment(id));
    const realRoot=await io.realpath(root);
    const realDirectory=await io.realpath(directory);
    if(!realDirectory.startsWith(realRoot+path.sep))throw fail(404);
    const meta = JSON.parse(
      await io.readFile(path.join(directory, "meta.json"), "utf8"),
    );
    if (!messageBelongsToUser(meta, actor)) throw fail(403);
    const attachment = meta.attachments.find(
      (item) => item.id === safeSegment(attachmentId),
    );
    if (!attachment) throw fail(404);
    const filePath = await io.realpath(
      path.join(directory, "attachments", safeSegment(attachment.storedName)),
    );
    const allowed = await io.realpath(path.join(directory, "attachments"));
    if (!allowed.startsWith(realRoot + path.sep) || !filePath.startsWith(allowed + path.sep)) throw fail(404);
    return { attachment, filePath, stat: await io.stat(filePath) };
  };
}
