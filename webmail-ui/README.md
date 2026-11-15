# MailBox Webmail UI

`mailbox-webmail-ui` is the Next.js Webmail module. Root Compose files connect it to Postfix and Dovecot. The production Ubuntu deployment is defined in [compose.platform.yaml](../compose.platform.yaml); start with the [installation guide](../docs/developer/guides/installation.md).

## Local Development

Use Node.js 24 with native `crypto.argon2` support.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Development still requires the account store and a correctly configured, certificate-verified SMTP submission backend for the corresponding features.

## Docker Configuration

Build from the repository root with Bake so that the common Node base and license contexts are available:

```bash
docker buildx bake -f docker-bake.hcl
```

Validate the production model after preparing `.env`, TLS, external networks and volumes:

```bash
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

Use the [operating procedure](../docs/developer/guides/operation.md) for actual startup or replacement. Typical container-side settings are:

- `SMTP_HOST=mailbox-smtp-receiver` and `SMTP_SUBMISSION_PORT=587`.
- `SMTP_AUTH_USER` / `SMTP_AUTH_PASSWORD`: a dedicated service account, supplied securely.
- `SMTP_TLS_SERVERNAME`: the hostname in the SMTP certificate.
- `SMTP_TLS_CA_FILE=/etc/mailbox/smtp-ca.pem`: the mounted public CA bundle.
- `MAILDIR_IMPORT_DIR=/mailboxes/mailbox/Maildir` and `MAILDIR_IMPORT_PARENT_DIR=/mailboxes`.
- `MAIL_DATA_DIR=/app/data` and `MAIL_ACCOUNT_DIR=/accounts`.
- `MAIL_DOMAINS` / `MAIL_DEFAULT_DOMAIN`: the operator's allowed receiving domains and default domain.

`SMTP_URL`, `ignoreTLS` and sendmail fallback are unsupported. Submission requires STARTTLS, CA/hostname verification and dedicated SASL authentication; TLS failure must not fall back to plaintext.

## Mail Storage

Webmail stores imported messages below `MAIL_DATA_DIR`:

```text
mail/inbox/<message-id>/
mail/sent/<message-id>/
mail/bounced/<message-id>/
```

Each directory contains `meta.json`, `body.txt`, `body.html` and an `attachments/` directory. Postfix delivers original messages into the `mailbox-store` Maildir volume. Webmail reads that volume through a read-only mount and imports messages into its own file store. No relational database is required.

## Sending Mail

The compose handler submits mail to Postfix over the verified SMTP path and records sent-message metadata. The authenticated user and `MAIL_DEFAULT_DOMAIN` determine the sender address. Recipients without a domain receive `MAIL_DEFAULT_DOMAIN`. Postfix acceptance does not guarantee final delivery; strict outbound TLS failures leave messages deferred in the queue.

## Accounts

Public signup requires a user ID and an 8–128-character password; no signup code is required. Provisioning updates the Dovecot passwd-file and Postfix recipient map together in `mailbox-account-store`. New accounts use salted Argon2id; existing BLF-CRYPT hashes remain supported and are not rewritten. Webmail and IMAP share these credentials. NUL characters are not allowed.

Legacy `users.json` IDs and existing recipient IDs remain reserved. Legacy users must prove ownership with their original password before migration; do not delete the legacy file to free an ID. Dedicated SMTP service IDs cannot be claimed through public signup. See [account operations and recovery](../docs/developer/guides/operation.md#accounts-and-recipient-addresses).
