import path from "node:path";
export const dataDir =
  process.env.MAIL_DATA_DIR || path.join(process.cwd(), "data");
export const mailRoot = path.join(dataDir, "mail");
export const dropInboxDir = path.join(dataDir, "drop", "inbox");
export const dropProcessedDir = path.join(dataDir, "drop", "processed");
export const dropFailedDir = path.join(dataDir, "drop", "failed");
export const maildirImportDir =
  process.env.MAILDIR_IMPORT_DIR || "/app/import/Maildir";
export const maildirImportParentDir =
  process.env.MAILDIR_IMPORT_PARENT_DIR || "";
export const maildirImportStatePath = path.join(
  dataDir,
  "maildir-imported.json",
);
export const boxes = ["inbox", "sent", "bounced"];
