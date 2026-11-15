# MailBox Ubuntu Platform Transition

Baseline: 2026-11-09 KST, Sprint Delivery. This historical handoff records image/isolated validation and production migration without secrets, message bodies or account hashes. Check the final section and protected local evidence for actual deployment results. Translation does not rerun tests, update historical versions or redeploy containers.

## Runtime and Builds

The production daemon was Docker Desktop `desktop-linux`, endpoint `unix:///Users/kkkk/.docker/run/docker.sock`, Linux ARM64, Engine 29.9.2. All four candidate containers ran Ubuntu 26.04. SMTP and Webmail shared the project-specific Ubuntu Node.js 24 base, using Node.js 24.22.2. The work did not wait for another session when a common contract/image was absent, and did not overwrite shared tags.

```sh
docker buildx bake
# If an explicitly verified Ubuntu 26.04 / Node.js 24 base is available:
NODE_IMAGE=<verified-image-reference> docker buildx bake
# Validate the model for existing production data:
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

The `node24` target in `docker-bake.hcl` copies the digest-pinned official Node.js 24.22.2 glibc binary into Ubuntu 26.04 and installs required runtime libraries. Both consumers accept `NODE_IMAGE` as a Docker build argument; otherwise Bake supplies the project target. `TAG` selects project image tags: the default was `ubuntu26.04`, and the validated candidate was `ubuntu26.04-20261109-r3`. Perform actual replacement through the locking/backup procedure below, not an unreviewed `up` that recreates operating containers. Current-source builds also require the [license context](container-packages.md) added later.

The repository has no production Python component/tool. Operational coordination used Node.js 24 and macOS system Perl's `flock(2)` without adding a Python runtime dependency. The Java probe is a transient validation tool using the actual DamGoX2 runtime, not a MailBox service. Because the consumer had only a JRE, its Java 17-compatible class was compiled with a separate JDK and run on that consumer JRE.

## Composition and Ports

The Compose project is **platform**. The four service/container names were `mailbox-smtp-receiver`, `mailbox-imap-mailbox`, `mailbox-webmail-ui` and `mailbox-webmail-proxy`. Shared `platform_default` is external: this model does not recreate/delete it. Only for a new installation should the integration operator prepare it with `docker network create platform_default`. Legacy `mailbox_default` is external too, preserving clients. Do not stop/down/remove-orphans for other platform services.

| Purpose | New Endpoint | Retained During Transition |
| --- | --- | --- |
| SMTP reception | Internal `mailbox-smtp-receiver:25`, host `25:25` | Internal 2525, same reception policy |
| Application submission | Internal `mailbox-smtp-receiver:587` | Internal 2587, same STARTTLS/SASL/authorization policy |
| IMAP | Internal/host 143 STARTTLS | Unchanged |
| Web HTTP | Host `20005:80` | Old `18080:80`, 308 redirect to new HTTPS 20006 |
| Web HTTPS | Host `20006:443` | Old `18443:443`, same certificate/application |
| API | `/api/` over HTTPS 20006 | Loopback `20105:3000` for local diagnostics only |

Web ports 20005–20009 and API ports 20105–20109 are reserved. This task did not publish 20007–20009 or 20106–20109. Diagnostic 20105 binds only to `127.0.0.1`, not a public plaintext authentication route. SMTP 587/2587 are not host-published. Later shared-edge deployments have different public mappings, recorded in their own operational documents.

When combining Compose files, the shared deployment must normalize build contexts, TLS, CA and log paths to absolute paths relative to this checkout. Run standalone commands here with `-f compose.platform.yaml`. Never overwrite an existing `.env` with the example.

## Actual DamGoX2 Impact

Read-only investigation found running `platform-damgox2-worker-1` using SMTP on `mailbox_default`. The initially inspected `damgox2-worker-1` had already stopped during another session's migration, so the actual running consumer was rediscovered at the deployment gate. The web role was connected only to its backend. The worker used `mailbox-smtp-receiver:2587`, mandatory STARTTLS, hostname validation, public CA and credential files. Its actual Java transport had `starttls.required=true`, `ssl.checkserveridentity=true`, TLS 1.2/1.3 and a separate trust store.

The existing worker was not edited/restarted. New SMTP joined both `platform_default` and legacy `mailbox_default`, taking over the old SMTP IP. Existing 2587 still rejected plaintext MAIL and AUTH before TLS, and allowed relay only for the dedicated service user. Private-network membership granted no relay permission. A disposable Java probe used the same JVM image, worker network namespace and actual read-only CA/credentials, authenticated then issued QUIT. It sent no MAIL/RCPT/DATA or external test message.

Follow-up migration for the shared deployment:

1. Verify port 587 using the same worker image/CA/credentials.
2. In that project's separately authorized deployment, set `DAMGOX2_MAIL_PORT=587`. Connect the worker to `platform_default` if needed; keep hostname, CA and service account unchanged.
3. Verify the actual new worker connection and restart, then inventory remaining consumers of 2525/2587 and old Web URLs.
4. Only after every consumer has migrated, separately remove compatibility listeners, `mailbox-compat` attachment/static IP, old Web ports and related variables. Never delete the five data volumes.

## Data, Ownership and TLS Contract

The five actual external volumes are `mailbox-store`, `smtp-queue-store`, `smtp-auth-store`, `mailbox-account-store` and `webmail-data-store`, preserving Maildir, Postfix spool, SASL socket, authoritative accounts and Webmail data. Identities are fixed: vmail UID/GID 5000, Postfix UID 100/GID 1500, postdrop GID 102 and mapbuilder UID 5010. The shared socket is root:GID 1500/mode 0660, with parent directory mode 0750.

New entrypoints do not recursively chown existing mail/accounts/data. They fail on incompatible shared identities/modes and create only required initial directories. SMTP master/virtual retain required UID-switching, delivery and signal privileges, adding NET_BIND_SERVICE for standard low ports. Initialization-only privileges are dropped before execution; mapbuilder remains UID 5010/capability zero. Webmail runs UID 5000/capability zero. Root roles are not approved risk acceptance.

Public 25/2525 offers STARTTLS, no AUTH, and rejects external relaying. Submission 587/2587 requires TLS and the dedicated SASL account. Webmail preserves `requireTLS`, CA/hostname verification and no fallback. Outbound MTA uses `smtp_tls_security_level=verify`. Certificates, CA, existing BLF-CRYPT/Argon2id hashes and the 8–128-character policy remain. Dovecot uses 2.4 syntax with `dovecot_storage_version=2.3.0` to retain index/rollback compatibility.

## Issues Found and Fixed in Isolation

- Old Webmail PID 1 exited 137 on SIGTERM. New code drains HTTP requests and closes the Next server, exiting zero. Nginx stops gracefully with SIGQUIT; container grace periods are configured.
- The old importer could treat new/cur movement and `:2,` read-flag changes as separate messages. Only comparison identity was stabilized; original ledger keys remain. Current raw-path aliases preserve Alpine rollback recognition. Existing cached message IDs/bodies/attachments/metadata are not deleted or merged. Concurrent SSR imports in one process share a serialized batch; ledger updates validate ownership/mode and use atomic rename.
- HTTP could become ready before SMTP. Fixture and production gates now wait for actual verified SMTP TLS/AUTH readiness.

## Security Packages and Final Scans

Assessment used actual Ubuntu 26.04 package revisions and official USNs, not upstream version numbers alone.

| Component | Installed/Floor Revision | Official Fix Evidence |
| --- | --- | --- |
| Postfix | `3.10.6-4ubuntu2.2`, including fixes from minimum `3.10.6-4ubuntu2.1` | [USN-8253-1](https://ubuntu.com/security/notices/USN-8253-1), CVE-2026-43964 |
| Dovecot 2.4 | `1:2.4.2+dfsg1-3ubuntu2.1` | [USN-8365-1](https://ubuntu.com/security/notices/USN-8365-1), authentication pipeline/SCRAM/Sieve/ACL/bracing fixes |
| Nginx | `1.28.3-2ubuntu1.12` | [USN-8955-1](https://ubuntu.com/security/notices/USN-8955-1), alias/map/HTTP3/AIO/session fixes |

Trivy 0.76.1 used DB UpdatedAt `2026-11-09T00:56:17.155719746Z` and scanned every severity, without ignore, severity filters or ignore-unfixed. The proxy's gettext Java archive was scanned with Java DB too. Actual Docker image/index -> platform manifest -> config digest was bound to raw scan metadata. Read-only containers reverified OS, Node and package profiles.

| Image | Final Image ID | MEDIUM / LOW |
| --- | --- | --- |
| smtp-receiver | `sha256:4cec1b75ee330042047bb916aeef49f9a4b91df15f63ef0a47eab0390c40f2c0` | 34 / 5 |
| imap-mailbox | `sha256:d5aee01a245e72531869757d78cb0301cbcff6a3776b0ffc3707d69b0804bbed` | 33 / 5 |
| webmail-ui | `sha256:8a1412f946588291234562e6300886cceaa441ef0242ff72ea0bc24991c8c318` | 31 / 4 |
| webmail-proxy | `sha256:bc537b637ff3d702353912ca8b5ae00279659c7445d37ef6811986e59bddcc7b` | 31 / 4 |

**HIGH 0 / CRITICAL 0 does not mean zero total findings.** Raw MEDIUM 129 / LOW 18 remained: 147 rows without fixed-version fields. Raw evidence distinguishes duplicate source CVEs across binaries/images from unique CVEs. Conditional components included glibc `fopen` mode inputs/nscd, dash/file tools/POD formatter and Cyrus DIGEST-MD5 client. This deployment did not run nscd/journald daemons or DIGEST-MD5 client, and did not execute mail as shell/POD/tar-restore input. That is neither a patch-completion assessment nor blanket risk acceptance. Ubuntu-unfixed findings remain handoff issues requiring reassessment if features/configuration change. Examples: [glibc fopen](https://ubuntu.com/security/cves/CVE-2026-18374.json), [nscd](https://ubuntu.com/security/cves/CVE-2026-89092.json).

Node.js 24.22.2 was the current 24 release at that time. The [November 11 HIGH security-release advance notice](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) preceded published CVEs/fixed versions and remained separately pending. Do not equate scanner zero with resolution of unpublished fixes.

## Validation and Actual Replacement Procedure

Ignored local evidence lives in `.agents/ubuntu-platform-20261109/reports/`; protected backups are in the task's `backups/` (directories 0700/files 0600). Runtime data/secrets are never committed.

- Final Ubuntu Node.js 24 images passed 39 unit tests and the production Next.js build.
- Roundtrip: old Alpine -> Ubuntu -> normal Ubuntu shutdown/restart -> Alpine rollback -> Ubuntu. Six isolated accounts, one Maildir message, setting/clearing Seen, UIDVALIDITY/UID, shared socket/modes, one held queue message and existing cache files were preserved. Final held-message release stayed local and produced two Maildir/Webmail messages. Five concurrent SSR requests returned identical counts.
- Checks covered 8-character/128-character ASCII/128-character Korean passwords and existing bcrypt, wrong final characters/lengths/NUL, ordinary-versus-service relay boundaries, old/new listeners, wrong CA/hostname and Secure cookies.
- All four final services exited zero. Old PID 1 decommission drained proxy, closed HTTP through a container-local shutdown channel and verified exit zero. The temporary channel was closed and never exposed externally. This one-time helper was not committed.

Actual replacement requires a real macOS `flock(2)` on the same inode of `/Users/kkkk/Desktop/jskang/03.workspace/01.project/operations/run/deploy.lock`. Verify that a separate nonblocking contender fails; hold the lock through replacement, validation, restart and any rollback. A PID file or marker is insufficient. Do not delete/replace the lock file.

1. Capture current IDs/images/configuration/mounts/network IPs and clients for the four containers. Check new-port conflicts, image scans, fixtures and guards.
2. Drain proxy, temporarily set old Webmail restart policy to `no`, and drain HTTP so `unless-stopped` cannot restart it immediately after exit zero. Gracefully stop IMAP/SMTP. Capture consistent mail/account/queue/metadata/ownership snapshots and tar all five volumes. Protect certificates, old `.env`, inspect records and rollback image refs.
3. Preserve old containers by renaming instead of removing them. Release the old SMTP endpoint IP for the new container. Retain secrets; change only Compose/image/port settings in `.env`.
4. Start new SMTP/IMAP/Webmail on the same five volumes. Verify data/ownership, TLS, SASL and actual worker 2587/587 before starting proxy and checking old/new Web URLs, login and cookies.
5. Explicitly stop/restart only these four services. Recompare original hashes, UIDs/flags, accounts, queue, cache files, original ledger entries, certificates and auth settings. Confirm other containers' IDs/images/StartedAt remain unchanged.

On failure, gracefully stop/remove only new MailBox containers; restore protected `.env`, original names/images, Webmail restart policy and SMTP IP/network attachment, then start with the same persistent data. Never blindly restore volumes over newly delivered valid mail. If data recovery is needed, stop affected services under the same lock, verify protected tar hashes/snapshots, and identify the exact damaged files/volumes first. No `down -v`, global prune, other-project stop or recursive chown.

## Recorded Production Results

Replacement and restart checks completed on 2026-11-09 at **14:52 KST** on the actual Docker Desktop Linux ARM64 daemon. All four containers ran the scanned final IDs above, project `platform`, with zero abnormal restarts and normal-stop exit zero.

| Container | ID Prefix | Recorded Package/Runtime |
| --- | --- | --- |
| mailbox-smtp-receiver | `4b911125af40` | Ubuntu 26.04.1 / Postfix 3.10.6-4ubuntu2.2 / Node.js 24.22.2 |
| mailbox-imap-mailbox | `2e7a8bf9a051` | Ubuntu 26.04.1 / Dovecot 2.4.2+dfsg1-3ubuntu2.1 |
| mailbox-webmail-ui | `1f5477dd250d` | Ubuntu 26.04.1 / Node.js 24.22.2 |
| mailbox-webmail-proxy | `96dbb37894b6` | Ubuntu 26.04.1 / Nginx 1.28.3-2ubuntu1.12 |

Two original accounts, five Maildir messages and an empty queue matched before/after replacement and restart. Original content/read flags, two UIDVALIDITY values, UID mappings, 21 Webmail files, five original ledger entries, account hashes, ownership/modes, certificate/CA and authentication secrets were preserved. The five volume names/mounts remained; the shared socket was root:1500/mode 0660.

Using the actual `platform-damgox2-worker-1` Temurin JRE 25.0.5 image (`sha256:9ac4289f24e5ab05c1bd93c831eaac8fb254c51e3b186b69d14bcd56f9f8b911`), network namespace and read-only CA/credentials, both 2587 and 587 passed CA/hostname/STARTTLS/AUTH. The worker itself was not edited/stopped/restarted. After replacement and restart, checks covered public-25 untrusted relay rejection, submission TLS/auth boundaries, existing IMAP accounts, old/new HTTPS login/inbox/Secure cookies, wrong CA/hostname and loopback API. No test DATA went to external recipients.

Lock inode `25825009` was held through replacement, validation and restart; an independent contender failed. The lock was released afterward without deleting the file. Ten other operating containers retained IDs/images/StartedAt/running state. An earlier interrupted attempt recovered automatically; `deploy-audit.jsonl` records attempts through final success.

### Preserved Recovery Resources

Protected `.agents/ubuntu-platform-20261109/backups/` uses directories 0700/files 0600. Final consistent five-volume `*-store.tar.gz` backups are under `volumes-2026-11-09T05-51-33-218Z/`; `reports/backup-inventory.json` records SHA-256 and sizes. Original `.env` is `production-before.env`; server certificates/keys are in `server-certificates/`; original container configurations are in `*.inspect.json`. The CA private key was neither read nor copied. Never attach these materials to Git/PRs.

The four old containers were retained stopped as `<original-name>-rollback-ubuntu-20261109`, with refs `<original-name>:rollback-ubuntu-20261109`. Original image IDs are in `reports/production-before.json` and protected inspect records. Old Webmail remains restart policy `no` to avoid automatic startup; restore original `unless-stopped` during recovery. Old SMTP was detached from `mailbox_default` for IP handoff. Other old containers were not removed.

Perform recovery **under the same shared file lock**:

1. Compare `deployment-summary.json` new/old IDs with current state/mounts. Capture fresh accounts/mail/queue snapshots/backups; preserve new mail. Git checkout alone is not recovery.
2. Gracefully stop current proxy (SIGQUIT, up to five minutes), Webmail (60 seconds), then IMAP/SMTP; verify exit zero. Remove only the four task-created containers or retain them stopped under different names, without deleting volumes. Detach new SMTP from `mailbox_default` to release `172.25.0.2`.
3. Restore protected `production-before.env` with its original mode. Restore original container names. Reattach old SMTP to `mailbox_default` with alias `mailbox-smtp-receiver` and IP `172.25.0.2`; restore old Webmail restart policy `unless-stopped`.
4. Start preserved old SMTP/IMAP/Webmail/proxy sequentially on the same volumes. Verify old ports 25/143/18080/18443, internal 2587 and original CA/hostname/SASL. Do not auto-recreate using a mixture of current `.env` and old/new Compose files.
5. Compare original/pre-recovery mail/UIDs/flags, account hashes, queue, ownership and actual worker connectivity. Apply tar restoration only to confirmed damaged data; never blindly overwrite current valid mail. Release the lock after validation, preserving its inode.

One-time locking/migration helpers remain ignored with runtime secrets. Completed `deploy.mjs` is not a tool for repeating recovery; use preserved containers and actual current state as above.

At the time of this record, GitHub scope was guarded human commit/push on feature branch `codex/mailbox-ubuntu-platform-20261109`; develop/main merges had not been requested in that step. Later integration is separate from this historical deployment record.
