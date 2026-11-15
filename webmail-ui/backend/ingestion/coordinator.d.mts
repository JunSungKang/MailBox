import type { MailBox } from "../domain/mail-types";
export function ingest(box: MailBox): Promise<void>;
