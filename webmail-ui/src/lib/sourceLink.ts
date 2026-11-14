const repository = "https://github.com/JunSungKang/MailBox";

export function sourceArchiveUrl(revision = process.env.MAILBOX_SOURCE_REVISION): string {
  const ref = /^[a-f0-9]{40}$/.test(revision || "") ? revision : "main";
  return `${repository}/archive/${ref}.tar.gz`;
}
