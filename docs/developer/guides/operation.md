# MailBox Operation

For the current shared `platform` deployment's memory settings, actual container names, image overrides, measurements, replacement and recovery, follow the [2026-11-11 performance record](performance-2026-11-11.md). Do not apply standalone commands blindly to the shared deployment.

## Status

```bash
docker compose -f compose.platform.yaml ps
docker compose -f compose.platform.yaml logs -f mailbox-smtp-receiver
docker compose -f compose.platform.yaml logs -f mailbox-imap-mailbox
docker compose -f compose.platform.yaml logs -f mailbox-webmail-ui
docker compose -f compose.platform.yaml logs -f mailbox-webmail-proxy
```

## Logs

Production Compose bind-mounts the SMTP container's `/var/log` into a host log directory. The default is `logs/smtp`; change it through `MAIL_LOG_DIR` in `.env`.

```bash
tail -f logs/smtp/postfix.log
```

IMAP, Webmail and the HTTPS proxy log to stdout. Postfix logs SMTP TLS connection information. Webmail authentication, message access and submission audit events retain the JSON Lines schema. Compose uses the local logging driver; `MAIL_LOG_MAX_SIZE` and `MAIL_LOG_MAX_FILE` control rotation size and file count.

```bash
docker compose -f compose.platform.yaml logs -f mailbox-imap-mailbox
docker compose -f compose.platform.yaml logs -f mailbox-webmail-ui
```

## Restart

```bash
docker compose -f compose.platform.yaml restart mailbox-webmail-proxy mailbox-webmail-ui mailbox-imap-mailbox mailbox-smtp-receiver
```

Hold the shared deployment lock and select only the four MailBox services, including for restarts.

Accounts and recipient maps persist in `mailbox-account-store` across restart, recreation and image rebuild. Never run `docker compose down -v` or explicitly delete a volume as an operational shortcut. The platform's external volumes must remain intact; other Compose models may manage volumes directly.

## Code and Image Replacement

Follow the [Ubuntu transition procedure](ubuntu-platform-transition.md), including shared locking, consistent backups, isolated validation and exact image-ID comparison. Build new images before stopping services.

```bash
docker buildx bake
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

With the lock held, explicitly replace only the four `mailbox-*` services using verified images. Do not manage other platform services or shared networks/volumes.

## Rollback

Under the same shared lock, follow the [transition record](ubuntu-platform-transition.md) to restore preserved containers, image refs, original `.env`, IPs and restart policies. Checking out code or rebuilding an image does not restore the previous running configuration. Do not blindly restore a volume backup over newer valid mail. Verify TLS, accounts, messages/UIDs/read flags, queues and clients before declaring recovery complete.

## TLS Checks and Certificate Rotation

```bash
openssl s_client -starttls imap -connect <hostname>:143 -servername <hostname> -verify_hostname <hostname> -verify_return_error -CAfile <public-ca-certificate>
openssl s_client -starttls smtp -connect <hostname>:25 -servername <hostname> -verify_hostname <hostname> -verify_return_error -CAfile <public-ca-certificate>
```

These commands verify a domain name. Use `-verify_ip` instead of `-verify_hostname` when verifying an IP. Publicly issued certificates can use the system CA store. After replacing the server certificate/key pair in `MAIL_TLS_DIR`, reload the services; the proxy reads the new pair on restart. Hold the deployment lock during operational changes.

```bash
docker compose -f compose.platform.yaml exec mailbox-smtp-receiver postfix reload
docker compose -f compose.platform.yaml exec mailbox-imap-mailbox doveadm reload
docker compose -f compose.platform.yaml restart mailbox-webmail-proxy
```

Public port 25 must reject nonlocal recipients for unauthenticated external peers and peers on the same private network. Internal 587 and compatibility 2587 must reject MAIL before TLS, then reject unauthenticated, incorrectly authenticated and ordinary IMAP users; only the dedicated `SMTP_AUTH_USER` may submit. Use RSET/QUIT after RCPT to test relay boundaries without sending mail. `MYNETWORKS` cannot bypass authorization. HTTP redirects use the configured Web hostname/HTTPS port; keep environment and selected proxy model consistent when DNS changes, then recreate the affected container.

## Image Builds and Publication

Each module builds with its Dockerfile and the `license_files` context. Use Bake to provide the shared Node base and license context together. For a distributable build, specify the committed source revision.

```bash
SOURCE_REVISION="$(git rev-parse HEAD)" TAG=local-check docker buildx bake -f docker-bake.hcl webmail
```

For a direct Dockerfile build, pass `--build-context license_files=.` from the root. Follow the reviewed-main workflow in the [container guide](container-packages.md) for official GHCR publication, native validation, immutable version/SHA tags, `latest` and package access.

## Accounts and Recipient Addresses

Signup updates the Dovecot user file and Postfix recipient map in `mailbox-account-store` together. SMTP's UID 5010 watcher detects changes, validates format, and atomically replaces the LMDB generated by `postmap`. Postfix detects the new index without a root reload watcher. After a successful signup, check:

```bash
docker compose -f compose.platform.yaml logs mailbox-webmail-ui | grep 'auth.signup.success'
docker compose -f compose.platform.yaml logs mailbox-smtp-receiver
```

Do not edit account files directly on the host or inside containers. For recovery, first back up `mailbox-account-store` and check both account files together for consistency.

Do not delete legacy `webmail-data-store/users.json`. Its IDs remain reserved. A legacy user must prove the original scrypt password to create the corresponding Dovecot account; already migrated accounts are unchanged. Automatic migration is blocked if the old password is outside 8–128 characters, contains the NUL prohibited by SASL PLAIN, or the legacy record is damaged. An operator must verify original ownership and perform separate recovery; deleting the file to release an ID is prohibited.

Before replacing the two account files, provisioning writes a mode `0600` recovery journal, `.provision.pending.json`, on the same volume. On interruption, startup and the next signup finish the remaining replacements under the same lock. Abandoned locks become reclaimable after 30 seconds; if an immediate restart reports `Account store is busy`, wait 30 seconds before retrying startup. Successful recovery emits `auth.account.recovered`; reconciliation of recipient maps for older partial accounts emits `auth.account.reconciled`, both at INFO. Preserve existing Dovecot password hashes and aliases.

If the journal and current files conflict, fail startup/signup without overwriting manual changes. Back up all three files together and investigate. The journal contains account hashes: do not attach it to logs/issues or delete it arbitrarily. A recovered account can log in with its signup password even if the original interrupted signup returned an error.

The SMTP provisioner (`npm run smtp:provision`) first verifies the existing dedicated account through validated TLS/AUTH. It attempts signup and verification only after authentication failure, never after TLS/network failure. New dedicated-service passwords must be 32–128 characters. Existing service credentials are checked through SMTP without forcing signup-policy revalidation.

New user passwords are 8–128 characters, excluding NUL. New hashes use Dovecot-compatible Argon2id: PHC v19, 64 MiB memory, three passes, parallelism one, 16-byte salt and 32-byte tag. Webmail accepts only this fixed profile so account-file parameters cannot request arbitrary memory/CPU costs. Do not rewrite existing BLF-CRYPT hashes during login or deployment. Rolling back to a Webmail image without Argon2id support prevents new Argon2id accounts from logging in; suspend new signup and review compatible images and account/mail backups before such a rollback.

## Security Checks

The [2026-11-04 security record](security-hardening-2026-11-04.md) documents image-specific historical findings and necessary root privileges. With `smtp_tls_security_level=verify`, outbound destinations without supported TLS or valid host certificates remain deferred. Investigate `status=deferred` and destination TLS instead of weakening encryption. To rotate the dedicated SMTP account, provision the new service identity through the supported internal path, update `SMTP_AUTH_USER` and its password together, and recreate the affected services.

## Dovecot 2.4 Transition and Rollback

IMAP uses Ubuntu 26.04's security-maintained Dovecot 2.4 packages. Use the repository's 2.4 configuration instead of copying 2.3 syntax unchanged. Retain `dovecot_storage_version=2.3.0` for existing index/rollback compatibility. On rebuild, validate `doveconf -n`, existing bcrypt STARTTLS login, Maildir UIDVALIDITY/UID/read state and Postfix SASL together in isolation, and rescan the changed image.

The [Ubuntu platform transition](ubuntu-platform-transition.md) covers builds, locking, real volumes, compatibility endpoints and recovery. Older `docker-compose*.yml` models are recovery references for their corresponding older commits/images.

Public signup rejects reserved service IDs with `auth.signup.reserved_id` and existing account/recipient conflicts with `auth.signup.exists`, both WARN events. The [2026-11-15 rollout record](open-signup-2026-11-15.md) describes signup-without-code validation, actual shared-edge deployment and recovery.
