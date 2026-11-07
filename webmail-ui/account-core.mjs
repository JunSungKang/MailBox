import { isValidUserId } from "./auth-core.mjs";
const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function parseDomains(value) {
  return [...new Set(String(value || "").split(/[\s,]+/).map((item) => item.trim().toLowerCase()).filter((item) => domainPattern.test(item)))];
}

export function parseDovecotUsers(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const fields = line.split(":");
      return { id: fields[0] || "", passwordHash: fields[1] || "", line };
    })
    .filter((account) => isValidUserId(account.id) && account.passwordHash);
}

export function dovecotUserLine(userId, passwordHash) {
  if (!isValidUserId(userId)) throw new Error("Invalid user id");
  if (!/^\{BLF-CRYPT\}\$2[aby]\$/.test(passwordHash)) throw new Error("Invalid password hash");
  return `${userId}:${passwordHash}:5000:5000::/var/mail/vhosts/${userId}::`;
}

export function mergeDovecotUser(raw, userId, passwordHash) {
  const accounts = parseDovecotUsers(raw);
  if (accounts.some((account) => account.id === userId)) throw new Error("Account already exists");
  const lines = accounts.map((account) => account.line);
  lines.push(dovecotUserLine(userId, passwordHash));
  return `${lines.sort((a, b) => a.localeCompare(b)).join("\n")}\n`;
}

export function mergePostfixAccounts(raw, userId, domains) {
  if (!isValidUserId(userId)) throw new Error("Invalid user id");
  if (!Array.isArray(domains) || domains.length === 0) throw new Error("At least one mail domain is required");
  const entries = new Map();
  for (const line of String(raw || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [address, destination] = trimmed.split(/\s+/, 2);
    if (address && destination) entries.set(address.toLowerCase(), destination);
  }
  for (const domain of domains) {
    if (!domainPattern.test(domain)) throw new Error("Invalid mail domain");
    entries.set(`${userId}@${domain}`, `${userId}/Maildir/`);
  }
  return `${[...entries].sort(([left], [right]) => left.localeCompare(right)).map(([address, destination]) => `${address} ${destination}`).join("\n")}\n`;
}
