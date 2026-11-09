// Comparison identity only. Persisted ledgers retain their original raw keys so
// previous releases can still recognize the exact current Maildir paths.
export function canonicalMaildirKey(value: string): string {
  const match = /^([^:]+):(new|cur)\/([^/]+)$/.exec(value);
  if (!match) return value;
  const uniqueName = match[3].split(":2,", 1)[0];
  return uniqueName ? `${match[1]}:message/${uniqueName}` : value;
}
