import type { MailMeta } from "./mailStore";

function addressBelongsToUser(value: string, userId: string): boolean {
  const addresses = value.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+/g) || [];
  return addresses.some((address) => address.split("@")[0] === userId);
}

export function messageBelongsToUser(message: MailMeta, userId: string): boolean {
  if (!userId) return false;
  if (message.box === "sent") return addressBelongsToUser(message.from, userId);
  return message.to.some((recipient) => addressBelongsToUser(recipient, userId));
}
