import { ingestMaildirBatch, copyExistingBounces } from "./maildir-import.mjs";
import { ingestInboxDropBatch } from "./drop-source.mjs";
let maildir, drop;
export async function ingest(box) {
  if (box === "inbox" || box === "bounced") {
    maildir ??= ingestMaildirBatch().finally(() => {
      maildir = undefined;
    });
    await maildir;
    drop ??= ingestInboxDropBatch().finally(() => {
      drop = undefined;
    });
    await drop;
  }
  if (box === "bounced") await copyExistingBounces();
}
