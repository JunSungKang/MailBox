export type StoredAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  storedName: string;
};
export declare function parseMailFile(
  sourcePath: string,
  attachmentsDirectory: string,
): unknown;
