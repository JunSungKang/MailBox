# MailBox Installation

## Prerequisites

- Install Docker Engine and the Docker Compose plugin on the Linux server.
- Point the connection hostname's DNS `A` record to the public IPv4 address, and point each receiving domain's `MX` record to that mail hostname. An MX target is a hostname, not an IP address.
- Allow inbound TCP `25` (SMTP), `143` (IMAP STARTTLS), `20006` (Webmail HTTPS) and `20005` (HTTPS redirect) through the firewall.
- Prepare `SPF`, `DKIM`, `DMARC` and `PTR/rDNS` separately if using outbound Internet delivery.

Create the environment file only for a new installation. Never overwrite an existing `.env`.

```bash
cp .env.example .env
```

Before production startup, set `WEBMAIL_SESSION_SECRET` to a random value of at least 32 characters. Production Webmail rejects placeholder secrets. Signup is public with a user ID and password; `WEBMAIL_SIGNUP_TOKEN` is unused, even if retained in an old environment file. Rotating the session secret invalidates existing sessions. Production Compose uses an HTTPS proxy and `Secure` login cookies; development HTTP uses `WEBMAIL_COOKIE_SECURE=false`.

Set `MAIL_DOMAINS` to the space-separated receiving domains created during signup. Prefer the first domain as `MAIL_DEFAULT_DOMAIN`. Accounts persist in the account-store named volume; the platform model references the exact existing name `mailbox-account-store`.

## TLS Certificates and Networks

Place an operator-issued certificate chain and unencrypted server private key in `MAIL_TLS_DIR` as `fullchain.pem` and `privkey.pem`. The default is `tls/` at the checkout root. SMTP, IMAP and the HTTPS proxy share this directory read-only. Compose fails if it is missing; IMAP cannot start without a valid certificate/key pair.

The certificate SAN must contain the actual connection domain or IP. Set `MAIL_WEB_HOSTNAME` to that address. The standalone platform proxy publishes HTTPS on `20006` and redirects HTTP `20005` to it. Legacy Compose models also use `MAIL_WEB_HTTPS_PORT`; check the selected model rather than assuming that changing this variable changes the platform's fixed mappings. Development also needs both certificate files. For a local CA, install the public CA certificate as trusted on client devices. Keep the CA private key outside the server-certificate directory.

```bash
chmod 600 .env
chmod 600 tls/privkey.pem
openssl x509 -in tls/fullchain.pem -noout -subject -issuer -dates
```

Replace `tls/` with the configured `MAIL_TLS_DIR` where applicable. Never commit certificates, private keys, `.env` or account files. Operators must arrange public CA issuance and renewal; this Compose model does not issue certificates automatically.

The legacy `mailbox_default` network defaults to `172.25.0.0/16`. Integrated production references the existing `platform_default` and `mailbox_default` as external networks and does not recreate them. Set `MAILBOX_COMPAT_SMTP_IP` after checking the actual previous SMTP IP. Network ranges do not authorize relaying; the old `MYNETWORKS` variable is unused.

Set `SMTP_AUTH_USER` to a dedicated service user (default `mailbox-submit`) and `SMTP_AUTH_PASSWORD` to a random 32–128-character password. Do not reuse a user's password. Set `MAIL_SMTP_CA_FILE` to the public CA bundle that validates SMTP; a deployment's public CA bundle is also suitable for a publicly issued certificate. `MAIL_HOSTNAME` must appear in the server certificate SAN. Never point this setting to a CA private key.

After startup, use internal bootstrap to register the dedicated account through the signup API and verify SMTP authentication. The service ID is reserved from public signup; creation requires both an actual loopback connection and the configured service password. Forwarded IP/Host headers do not grant permission. Bootstrap never overwrites an existing account. On failure, inspect the protected operational credentials and account configuration.

```bash
docker compose -f compose.platform.yaml exec --user 5000:5000 mailbox-webmail-ui node smtp-bootstrap.mjs
```

Do not publish internal submission `587` or compatibility `2587` to the host. Public SMTP `25` maps to container `25`; the old `2525` listener remains available for existing internal consumers. Dovecot and Postfix share their authentication socket through `smtp-auth-store`, separate from the account and mail volumes.

## Build and Configuration

Build the common Ubuntu Node.js 24 base and four images first. Omitting `NODE_IMAGE` builds the project-specific Ubuntu base.

```bash
docker buildx bake
```

For an existing production installation, follow the [shared-lock, backup and recovery procedure](ubuntu-platform-transition.md). The platform model requires five existing volumes and two networks. For a new installation, operators must first prepare the accounts, directory ownership and networks. This command validates configuration only:

```bash
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

## Verification

Check all four containers with `docker compose -f compose.platform.yaml ps`. The standalone Webmail login is `https://<MAIL_WEB_HOSTNAME>:20006/login`. With a local CA, verify the server using `curl --cacert <public-ca-certificate> https://<hostname>:20006/login`.

Development Compose exposes Webmail HTTP on loopback only. Use production Compose for external access. SMTP `25` is for server-to-server reception. Webmail uses internal `587` with TLS and dedicated SASL credentials. Do not expose submission ports to external hosts.

## Migrating an Existing Installation

The scrypt hashes in legacy `webmail-data-store/users.json` cannot be safely converted directly into Dovecot passwd-file hashes. Back up the data and ask legacy users to sign up again with the same ID and original password. The new version reserves legacy IDs and verifies ownership using the original scrypt password before creating an Argon2id account. Do not modify or arbitrarily delete `users.json`. Existing Dovecot BLF-CRYPT accounts and hashes remain unchanged.

The [Ubuntu platform transition](ubuntu-platform-transition.md) covers builds, shared locking, real volumes, compatibility endpoints and rollback. Older `docker-compose*.yml` models are references for recovery with their corresponding older commits/images.
