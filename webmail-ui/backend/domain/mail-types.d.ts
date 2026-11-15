export type MailBox = "inbox" | "sent" | "bounced";

export type AttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  storedName: string;
};

export type DeliveryMeta = {
  attempted: boolean;
  ok: boolean;
  detail?: string;
};

export type MailMeta = {
  id: string;
  box: MailBox;
  from: string;
  to: string[];
  subject: string;
  date: string;
  attachments: AttachmentMeta[];
  delivery?: DeliveryMeta;
};

export type MailMessage = MailMeta & {
  bodyText: string;
  bodyHtml: string;
};
