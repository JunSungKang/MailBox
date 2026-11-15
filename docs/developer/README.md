# MailBox Developer Guide

Last updated: 2026-11-15

This area explains the project structure and runtime flow for developers. AI agent completion rules belong in `docs/ai-agent`.

## Recommended Reading Order

1. [MailBox Onboarding](./onboarding/mailbox-onboarding.md)
2. [System Architecture](./architecture/system-architecture.md)
3. [Installation](./guides/installation.md)
4. [Operation](./guides/operation.md)
5. [Troubleshooting](./guides/troubleshooting.md)
6. [User Guide](./guides/user-guide.md)
7. [Container Packages](./guides/container-packages.md)

## Developer Checklist

- Identify whether the change belongs to SMTP, IMAP, Webmail or Compose before editing.
- Before changing Webmail, inspect `webmail-ui/package.json`, `server.mjs` and the related `src/app` and `src/lib` code together.
- Update development and production Compose files and documentation together when changing volumes or environment variables.
- Before committing, run Webmail tests/builds when relevant and validate changed Compose files or documentation.
- Write repository documentation and release notes in English.
