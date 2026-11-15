# MailBox Onboarding

Last updated: 2026-11-15

## Project Summary

MailBox is a single-node mail server with three core modules. Postfix delivers SMTP messages into Maildir; Dovecot and Next.js Webmail expose the same original mail through their respective interfaces. Production adds an Nginx HTTPS proxy, for four containers in total.

## Stack

- SMTP: Ubuntu 26.04 Postfix with distribution security backports; Node.js runs only the unprivileged account-map watcher.
- IMAP: Dovecot 2.4 on Ubuntu 26.04, retaining a Dovecot 2.3-compatible storage/index version.
- Webmail: Node.js 24, Next.js 16, React 19, TypeScript 6.
- Mail parsing/sending: `mailparser`, `nodemailer`, `busboy`.
- Production Webmail HTTPS: Nginx.
- Composition: Docker Compose (`platform`, `compose.platform.yaml`) and Docker Bake.

## Directory Ownership

- `smtp-receiver`: `main.cf`, recipient maps, container entrypoint.
- `imap-mailbox`: `dovecot.conf`, IMAP users, container entrypoint.
- `webmail-ui`: App Router pages, custom Node server, mail file storage and authentication.
- `docker-compose.yml`: source-built development model.
- `compose.platform.yaml`: integrated four-service Ubuntu production model.
- `docker-bake.hcl`: shared Node.js 24 base and four image builds.
- `docker-compose.prod.yml`: previous execution model and rollback reference.
- `docs/ai-agent`: agent work rules.
- `docs/developer`: developer onboarding and operational knowledge.

## Commands

```bash
# Prepare .env from .env.example only for a new installation; preserve an existing .env.
# Follow the installation guide to configure secrets and certificates in MAIL_TLS_DIR.
docker buildx bake
docker compose --env-file .env -f compose.platform.yaml config --quiet
docker compose -f compose.platform.yaml ps
npm test --prefix webmail-ui
npm run build --prefix webmail-ui
```

For actual replacement, follow the [transition procedure](../guides/ubuntu-platform-transition.md), including shared locking, backup and recovery gates. See [installation](../guides/installation.md) for certificates, networks and production HTTPS. The UI uses the bright, future-inspired “Tomorrow's Mailbox” theme.

## Webmail Entry Points

- `webmail-ui/server.mjs`: HTTP server, login/signup/logout, multipart submission, attachment download.
- `webmail-ui/auth-core.mjs`: shared HMAC session creation and verification.
- `webmail-ui/src/app`: inbox, sent, bounced, compose, login, signup and detail pages.
- `webmail-ui/src/lib/mailStore.ts`: Maildir import and Webmail file storage.
- `webmail-ui/src/lib/mailAccess.ts`: per-user message ownership.
- `webmail-ui/src/lib/auditLogger.ts`: structured audit logging.

[System Architecture](../architecture/system-architecture.md) describes structure and data flow. The [Ubuntu platform transition](../guides/ubuntu-platform-transition.md) records integrated builds and migration.
