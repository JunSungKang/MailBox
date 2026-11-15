import type { MailBox, MailMeta, MailMessage } from "../domain/mail-types";
export function createMailboxService(deps: {
  repository: {
    ensureMailDirs(): Promise<void>;
    listStoredMessages(box: MailBox): Promise<MailMeta[]>;
    readMessage(box: MailBox, id: string): Promise<MailMessage | null>;
  };
  ingest?: (box: MailBox) => Promise<void>;
}): {
  listMailbox(input: { actor: string; box: MailBox }): Promise<MailMeta[]>;
  getMessage(input: {
    actor: string;
    box: MailBox;
    id: string;
  }): Promise<MailMessage | null>;
};
