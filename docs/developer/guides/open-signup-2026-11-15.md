# Signup Without Invitation Codes

As of 2026-11-15, signup is public with a user ID and password. The signup code field, server comparison and startup code requirement were removed. New passwords retain the 8–128-character policy and prohibit NUL. Dedicated SMTP IDs and existing recipient local parts remain reserved. Only internal bootstrap proving both a real loopback connection and the configured service password can create the service ID; forwarded headers grant no authority. Legacy users proving their original password may still migrate a shared Maildir delivery path. Duplicate-ID protection, original-password verification for legacy `users.json`, account-file locking, atomic updates and recovery journals remain. JSON Lines audit events record signup/login success, failure and service-ID rejection without passwords or session values.

The three Compose definitions, `.env.example` and SMTP bootstrap no longer depend on `WEBMAIL_SIGNUP_TOKEN`. An old environment value is ignored. `WEBMAIL_SESSION_SECRET`, SMTP service credentials, TLS/CA verification and `Secure`/`HttpOnly`/`SameSite=Lax` cookies remain. Existing accounts and hashes are neither converted nor reset.

This is a historical rollout record; the values below describe the recorded deployment rather than a fresh deployment or scan performed during translation.

## Validation

- The final Ubuntu 26.04.1 / Node.js 24.22.2 image passed the production Next.js build and all 49 unit tests.
- On a dedicated internal network with synthetic account/data volumes, 37 signup checks and 22 post-shutdown/restart checks passed. Production data was not mounted. A separate peer supplying the correct service password and forged loopback headers was rejected before service-account creation. Checks also covered alias/orphan/old-domain ID reservation, internal bootstrap and original-password-authorized legacy delivery-path migration.
- Without a code environment variable or form field, checks covered signup, 8-character and 128-character Korean passwords, login, invalid password/length/NUL/ID rejection, no hash changes on duplicate signup, prevention of legacy-ID takeover, ownership-proved migration and Secure signed sessions.
- Success/failure audit events were present and test credentials absent from logs. An initial helper read only stdout and missed WARN events; collecting stdout/stderr together resolved the verification issue without another application change.
- All three Compose models rendered without a signup-code variable. `tests/platform/signup-check.mjs` runs only after fixture-only gates and domain checks pass.
- The final archive -> manifest -> config digest matched Trivy evidence. Trivy 0.76.2 used the DB updated at 2026-11-15 04:00 KST: HIGH 0 / CRITICAL 0, with MEDIUM 17 / LOW 4 / UNKNOWN 1 remaining, representing 12 unique CVEs. Of 22 raw rows, 21 had no fixed-version field. Remaining findings were not treated as resolved.
- The isolated Web container, one-time peer probe, two dedicated volumes, internal network and test environment file were removed. No test mail was sent to real external recipients.

Independent review after the first rollout found boundaries allowing claims of a new SMTP service ID and an existing recipient alias. The previous image was restored under the lock, temporarily restoring signup restrictions. The reservation policy and regression checks above were added, and r2 was revalidated and deployed. Both rollback and final replacement preserved two accounts, five messages and their original paths/files.

## Actual Production Rollout

Operating replacement and normal-restart verification completed on 2026-11-15 at **05:32 KST**, using the actual Docker Desktop `desktop-linux` socket and `linux/arm64`. The new Webmail image used the existing project-specific base through `NODE_IMAGE=mailbox-node24:ubuntu26.04-20261109-r3`. No shared image tag was overwritten.

| Item | Recorded Value |
| --- | --- |
| Compose project / service | `platform` / `mailbox-webmail-ui` |
| Container | `mailbox-web` (`c5034bd2bc5d`) |
| Image tag | `mailbox-webmail-ui:open-signup-20261115-r2` |
| Image ID | `sha256:fa092416f9a94fe971a146337a1caa837116be7fb95bbcabe7e3b5174d88614f` |
| Image config digest | `sha256:6e51fc2163486b7fc26049a762e3dd31ad503cb96b55dc2eee6ea7f11877cb74` |
| Actual HTTPS | `https://175.195.62.165:20005` |
| Existing HTTPS alias | `20006` redirects to HTTPS `20005` |
| Diagnostic endpoint | `127.0.0.1:20105 -> 3000` |
| Networks | `platform_edge-mail`, `platform_mailbox-backend` |

The shared edge Nginx terminated TLS, so only `mailbox-web` was replaced. The other 17 containers, including shared Nginx, SMTP and IMAP, retained their IDs/images/StartedAt/running state. Neither `operations/` nor other projects were changed. Distinguish standalone HTTP 20005 / HTTPS 20006 from the shared edge's HTTPS 20005 / alias 20006.

A real macOS `flock(2)` was held on inode `25825009` of `/Users/kkkk/Desktop/jskang/03.workspace/01.project/operations/run/deploy.lock`. An independent contender failed to acquire it; the lock covered backup, replacement, validation and restart. Before replacement, the TLS-negative helper was adjusted to exclude HTTP connection reuse. Wrong CA and hostname were both rejected on fresh connections before proceeding.

Comparisons preserved two accounts, five Maildir messages, an empty queue, 21 Webmail files, five import-ledger entries and 150 ownership/mode entries. All five volumes (`mailbox-store`, `smtp-queue-store`, `smtp-auth-store`, `mailbox-account-store`, `webmail-data-store`) and original mounts/networks/ports remained. The auth socket was root:1500/mode 0660. Webmail ran as UID 5000 with no capabilities and V8 old/semi spaces of 512/16 MiB, with no OOM, abnormal exit or automatic restart.

Actual HTTPS checks covered the signup page and validation without a code. Only invalid passwords were submitted in production; no production test account was created. Existing login/inbox, certificate/hostname verification, wrong-CA/hostname rejection and SMTP/IMAP authentication/TLS were checked. A disposable probe using the actual `damgox2-worker` JVM image/network namespace and read-only CA/credentials completed STARTTLS/CA/hostname/AUTH then QUIT on existing port 2587. It issued no MAIL/RCPT/DATA.

## Reproduction and Recovery

Protected material remains under ignored `.agents/open-signup-20261115/` (directories `0700`, secret files `0600`). `backups/original-web.inspect.json`, `backups/runtime-before.compose.json` and `backups/runtime-open-signup.compose.json` contain actual credentials/environment values: never attach them to Git/PRs/logs. The models select only Webmail and reference original networks/volumes as external. Literal `$` characters are preserved in Compose values.

With Webmail gracefully stopped as the sole account/cache writer, consistent account-store and Webmail-data tar backups were created under `backups/volumes-2026-11-14T20-31-25-475Z/`; hashes and tar headers were verified. SMTP/IMAP continued using Maildir, queue and the auth socket, so this was not a static all-five-volume backup. See `reports/backup-inventory.json` for inventory/SHA-256.

Subsequent shared-deployment recreation must retain the new Webmail image and original mounts/environment/networks/ports. This task did not change `operations/edge/runtime.compose.json`; recreating its older image can revert the code. The internal endpoint remains `mailbox-web:3000`; client endpoints are unchanged. Use protected `backups/runtime-open-signup.compose.json` with `backups/empty.env`, project `platform`, options `--no-deps --no-build --pull never`, selecting only `mailbox-webmail-ui` to reproduce this deployment.

For recovery, hold the same shared lock and verify current container/image IDs. Gracefully stop only Webmail, remove only its container without deleting volumes, then start the old Webmail using `backups/runtime-before.compose.json` and `backups/empty.env`. Rollback ref `mailbox-web:before-open-signup-20261115` points to `sha256:9227e6e4f93c836815b49a7102931059cc9dfdfac11d66abeb0adc5701825d5b`. Recheck HTTPS, existing accounts, SMTP TLS/SASL, messages, UIDs/flags, ownership and the real client. Never blindly restore tar data over current accounts/mail. Do not rerun the completed one-time `deploy.mjs` as a recovery procedure.

No `down -v`, global prune, other-project stop, shared-Nginx restart or recursive chown was performed. One-time deployment/lock helpers and secret backups stay ignored and uncommitted. Raw evidence is in `reports/deployment-summary.json`, `production-after-preserved.json`, `restart-web.json`, `restart-consumer.json`, `untouched-after.json` and `deploy-lock-proof.json`.
