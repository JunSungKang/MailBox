# MailBox Architecture Contract

Last updated: 2026-11-15

## Repository Ownership

Use `MailBox` for display, `mailbox` for machine identifiers and `mail-box` for the local checkout directory. Preserve existing domain terms that refer to a mailbox itself, such as the `MailBox` TypeScript type and `mailbox-store` volume.

```text
compose.platform.yaml + docker-compose*.yml
  -> smtp-receiver
  -> imap-mailbox
  -> webmail-ui

docs/ai-agent   -> work rules and invariant contracts
docs/developer  -> human developer guidance and operational knowledge
```

| Path | Owns | Does Not Own |
| --- | --- | --- |
| `smtp-receiver` | Postfix configuration, recipient addresses, Maildir delivery | Webmail users/UI, IMAP authentication |
| `imap-mailbox` | Dovecot configuration, IMAP access to Maildir | SMTP routing, Webmail storage format |
| `webmail-ui` | Login, per-user mail access, sending, Web UI storage, HTTPS proxy configuration | Postfix/Dovecot system configuration |
| Root Compose | Container connections, ports, volumes, environment variables | Module business logic |
| `docs/ai-agent` | Change procedure, validation, prohibited actions | Human-oriented onboarding |
| `docs/developer` | Architecture, setup, operations, user guidance | Agent-only workflow contracts |

## Allowed Dependency Direction

```text
Docker Compose -> module public runtime surface
webmail-ui/src/app -> src/server -> backend/application
webmail-ui/src/app -> src/features + src/components + pure view models
webmail-ui/server.mjs -> backend/bootstrap -> backend/http -> backend/application
backend/application -> domain + infrastructure contracts
smtp-receiver -> mailbox-store <- imap-mailbox
webmail-ui -> mailbox-store (read-only import)
webmail-ui -> smtp-receiver (SMTP submission)
webmail-ui -> mailbox-account-store (account provisioning)
smtp-receiver + imap-mailbox -> mailbox-account-store (runtime account read)
```

SMTP and IMAP must not import Webmail internals; Webmail must not modify Postfix or Dovecot configuration files.

## Security Invariants

- Accept new passwords of 8–128 characters and store Dovecot-compatible salted Argon2id hashes that verify the entire password. Continue verifying existing BLF-CRYPT accounts without changing their hashes. Never store or log plaintext passwords.
- SMTP `25` offers STARTTLS with TLS 1.2 or later; IMAP `143` requires STARTTLS before login.
- Mount only the server certificate/key from `MAIL_TLS_DIR` read-only into the relevant services. Keep the CA private key outside that directory. Never track certificates, keys or `.env`.
- Expose production Webmail only through an HTTPS proxy and use `Secure` login cookies. Development HTTP is loopback-only.
- Public SMTP must not authorize external relaying based on network location, including private networks or loopback. Fix `mynetworks` to loopback.
- Applications submit to internal `587` (with the same policy on compatibility `2587`) using a dedicated SASL account and mandatory STARTTLS. Never skip CA/hostname verification or fall back to sendmail/plaintext on failure.
- Outbound MTA delivery uses `smtp_tls_security_level=verify` and requires TLS and MX-host certificate verification. Defer unsupported destinations in the queue.
- The Dovecot SASL socket in `smtp-auth-store` is accessible only to root and dedicated SMTP GID 1500. The account-map watcher runs as UID 5010 with no capabilities.
- Distinguish the required root privileges of Postfix master/virtual from ordinary workers. Do not treat remaining root privileges as approved risk acceptance.
- Trust `mailbox_user` only after HMAC cookie verification.
- Signup is public with a user ID and an 8–128-character password. It creates the Dovecot user and Postfix recipients for allowed domains together. Preserve duplicate-account and legacy-ownership checks. Reserve existing recipient local parts across domains; migrate a legacy ID's delivery path only after proof with its original password. Create the SMTP service ID only through internal bootstrap proving both a real loopback peer and the configured service password. Forwarded headers do not grant this authority.
- Enforce current-user ownership for inbox, sent, bounced, details, attachments and sending.
- Mount `mailbox-store` read-only in Webmail.
- `mailbox-account-store` is authoritative; only Webmail updates its two narrowly scoped account files.

## Data Invariants

- SMTP and IMAP share Maildirs in `mailbox-store`.
- Postfix queues live in `smtp-queue-store`; Webmail imported data and legacy users live in `webmail-data-store`.
- Preserve Dovecot users and Postfix recipient maps in `mailbox-account-store`.
- `docker compose down` preserves volumes; `down -v` removes volumes managed by the selected model. The platform model declares the five existing volumes external; never remove them explicitly either.
- Do not add generated release artifacts, one-time packaging scripts or tracked sprint contracts to the repository. Maintained release tooling and workflows remain source code.

## Platform Runtime

Production uses the `platform` Compose project and `mailbox-*` services. All four runtimes use Ubuntu 26.04. Webmail and SMTP accept the same Ubuntu Node.js 24 base through the `NODE_IMAGE` argument. Preserve all five existing external named volumes; do not recursively change their ownership. Standard internal ports are SMTP 25, submission 587, IMAP 143 and proxy 80/443. Remove compatibility ports 2525/2587, `mailbox_default` connectivity and old Web URLs only in a separate task after consumers have migrated.

## Modular Webmail

Follow [Modular Webmail](../developer/architecture/modular-webmail.md) for runtime, server/client boundaries, package identity, test commands and rollback. Keep the Next-only `server-only` bridge out of native Node modules. Preserve the single SSR ingestion writer and explicit Docker copies.
