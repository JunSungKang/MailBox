import type { MailMeta } from "./mail-types";
export declare function messageBelongsToUser(
  message: MailMeta,
  userId: string,
): boolean;
