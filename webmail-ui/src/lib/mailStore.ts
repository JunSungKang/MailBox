// Compatibility exports; pages access data through the authorized server service.
export type * from "../../backend/domain/mail-types";
export { isMailBox } from "../../backend/infrastructure/filesystem/message-repository.mjs";
export { formatBytes, formatDate } from "../shared/format";
export const boxLabels = {
  inbox: "받은 편지",
  sent: "보낸 편지",
  bounced: "돌아온 편지",
};
