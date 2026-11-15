# AGENTS

The project name is `MailBox`. Use `mailbox` for machine identifiers and `mail-box` for the local checkout directory.

Keep executable modules directly discoverable at the repository root.

- SMTP receiver code belongs in `smtp-receiver`.
- IMAP mailbox code belongs in `imap-mailbox`.
- Webmail code belongs in `webmail-ui`.
- Root Docker Compose files own service composition and startup.
- AI agent rules belong in `docs/ai-agent`; human developer documentation belongs in `docs/developer`.
- Follow the Required Reading in `docs/ai-agent/README.md` before starting work.
- Use `sprint/` contracts locally for the guarded GitHub workflow; never commit them.
- Do not commit generated packages or one-time deployment scripts.
- Write and maintain repository documentation, README files, contribution guidance and release notes in English. This does not change the application's UI language.

## Operational logging

- When adding or changing a feature, add logs that let operators trace who used it, when, from where, and whether it succeeded or failed.
- Use `INFO`, `WARN` and `ERROR` levels.
- Record normal user actions and operational events as `INFO`, abnormal requests and access failures as `WARN`, and feature failures and exceptions as `ERROR`.
- Serialize structured objects with `JSON.stringify` as JSON Lines; do not construct logs by concatenating human-written strings.
- Include `time`, `level`, `event`, `requestId`, `actor`, `ip`, `userAgent`, `method`, `path`, `durationMs` and `status` wherever available.
- Use consistent dotted event names such as `mail.send.success` and `mail.detail.view`.
- Never log message bodies, attachment contents, passwords, tokens, cookies or complete authentication headers.
- Log personal information such as full recipient addresses or subjects only when necessary. Prefer counts, domains, IDs or hashes by default.
- Webmail server audit logs must follow the schema in `webmail-ui/src/lib/auditLogger.ts`.
