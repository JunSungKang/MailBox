import type { MailBox, MailMeta, MailMessage } from "../../domain/mail-types";
export function isMailBox(value: string): value is MailBox;
export function listStoredMessages(box: MailBox): Promise<MailMeta[]>;
export function readMessage(
  box: MailBox,
  id: string,
): Promise<MailMessage | null>;
export function ensureMailDirs(): Promise<void>;
