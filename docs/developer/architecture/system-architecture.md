# MailBox System Architecture

Last updated: 2026-11-15

## Module Boundaries

- `smtp-receiver`: accepts Internet SMTP traffic and delivers messages into Maildir with Postfix.
- `imap-mailbox`: exposes the same Maildir volume through Dovecot IMAP.
- `webmail-ui`: reads Maildir into its own mail store and submits outgoing messages to SMTP.
- Production `mailbox-webmail-proxy`: terminates Webmail HTTPS with Nginx using `webmail-ui/nginx.conf.template`.

Each module owns its Dockerfiles and configuration. Only root Compose assembles inter-module networks, volumes, ports and environment variables.

| Module | Port | Input | Output |
| --- | --- | --- | --- |
| `smtp-receiver` | Public `25` | SMTP, recipient maps | Maildir, Postfix queue/logs |
| `imap-mailbox` | Public `143` | Maildir | IMAP mailbox |
| `webmail-ui` | Internal `3000`; production diagnostic loopback `20105` | HTTP, read-only Maildir, SMTP transport | HTML, Webmail data, SMTP submission |
| Production HTTPS proxy | `20006 -> 443`, `20005 -> 80`; old URLs retained temporarily | HTTPS, HTTP redirect | Internal Webmail HTTP |

## Runtime Flow

```text
Internet SMTP
  -> smtp-receiver
     -> mailbox-store (Maildir)
        -> imap-mailbox
        -> webmail-ui import

webmail-ui compose
  -> smtp-receiver
  -> sent mailbox metadata
```

SMTP, IMAP and Webmail share `mailbox-store`. `smtp-queue-store` preserves the Postfix queue; `webmail-data-store` preserves imported Webmail messages; `mailbox-account-store` preserves Dovecot users and Postfix recipient maps. `smtp-auth-store` shares the Dovecot/Postfix authentication socket.

Webmail reads original Maildir messages through a read-only mount and imports them into its own file format. Each `mail/{inbox,sent,bounced}/<message-id>` directory contains `meta.json`, `body.txt`, `body.html` and `attachments/`.

## Webmail Request Flow

```text
browser
  -> production HTTPS proxy (loopback HTTP in development)
  -> server.mjs auth/send/download handlers
  -> Next.js App Router pages
     -> auth-core signed session
     -> mailAccess ownership rule
     -> mailStore filesystem/import rule
```

HMAC-signed cookies identify logged-in users. Passwords are verified against hashes in the Dovecot passwd-file in `mailbox-account-store`. New accounts use Argon2id, verifying the full 8–128-character password; existing salted bcrypt (BLF-CRYPT) accounts remain supported without rewriting their hashes.

Public signup creates the Dovecot user, Postfix recipients for each allowed domain, and the user's Maildir delivery path. Existing recipient local parts are reserved across domains; a legacy account may migrate an ID only after proving ownership with its original password. Internal bootstrap may create the SMTP service ID only when it proves both a real loopback peer and the configured service password. Inbox/bounced access requires the recipient local part to match the current user; sent-mail access requires the sender local part to match. The same rules apply to details and attachments.

```text
webmail signup
  -> mailbox-account-store/dovecot-users
  -> mailbox-account-store/virtual-mailbox-accounts
     -> UID 5010 watcher: validate + postmap + atomic LMDB replacement
  -> mailbox-store/<user>/Maildir
```

Outgoing mail fixes the sender to the logged-in user ID and `MAIL_DEFAULT_DOMAIN`. Webmail submits over internal `SMTP_HOST:587` with verified STARTTLS and a dedicated SASL account; compatibility `2587` has the same policy. A client-supplied sender string does not grant sending authority.

## Configuration Boundary

- `.env` supplies shared host, domain, port, image and volume values to Compose.
- SMTP, IMAP and the proxy read server certificates/keys from `MAIL_TLS_DIR` through read-only mounts. Do not share the CA private key. SMTP offers STARTTLS; IMAP login requires TLS 1.2 or later.
- Production Webmail is public through HTTPS. The HTTP listener redirects to `MAIL_WEB_HOSTNAME` and `MAIL_WEB_HTTPS_PORT`. Development HTTP is loopback-only.
- `MAIL_NETWORK_SUBNET` configures only the Compose network, never relay authority. Public `25 -> 25` (with compatibility listener `2525`) receives only local-domain mail. Internal `587` and compatibility `2587` require TLS and the allowed dedicated SASL user.
- Dovecot provides SMTP AUTH through the Unix socket in `smtp-auth-store`, mounted read-only by SMTP. Ordinary IMAP authentication does not grant submission authority.
- `MAIL_SMTP_CA_FILE` is a public CA bundle for server verification. Do not share the server private key with Webmail. Outbound MTA delivery also defers mail when TLS or certificate verification fails.
- Production rejects a placeholder `WEBMAIL_SESSION_SECRET`. `WEBMAIL_SIGNUP_TOKEN` is unused and is not required for signup.
- Production sets `WEBMAIL_COOKIE_SECURE=true`; development HTTP uses `false`.
- Signup registers receiving IDs in `mailbox-account-store/virtual-mailbox-accounts`.

## Repository Principles

Track runtime modules, Compose definitions, maintained tooling and documentation. Recreate image builds and distributable artifacts from source; do not store generated packages in the repository. `sprint/` contracts are local guard inputs and must not be tracked.

The `platform` project in `compose.platform.yaml` owns the integrated production model. It references five existing external volumes. Diagnostic API access is loopback `20105`; normal API access uses `/api/` over HTTPS `20006`. The [transition record](../guides/ubuntu-platform-transition.md) documents migration, validation and distribution security-package assessment. Shared-edge installations have separate public URL mappings recorded in the later operational records.

Maildir/drop MIME attachments stream with backpressure while preserving CID conversion and the import ledger. Metadata I/O is limited to 32 concurrent operations per request and Maildir sources to four. Webmail V8 old/semi spaces of 512/16 MiB, two proxy workers and upstream keepalive eight are defaults measured for the workload in the [performance record](../guides/performance-2026-11-11.md); use configuration overrides when tuning a different workload.
