# MailBox Memory and Performance Optimization

2026-11-11, Sprint Delivery. This historical record preserves the Ubuntu 26.04 / Node.js 24 runtime, 8–128-character password/hash profile, TLS/CA/hostname verification, SASL and relay restrictions. At the recorded deployment, production used the `platform` project in `operations/compose.yaml`, with containers `mailbox-web`, `mailbox-proxy`, `mailbox-smtp` and `mailbox-imap`. The task changed only the MailBox checkout, not shared operating files. Translation does not rerun these benchmarks or redeploy services.

## Changes

- Maildir/drop input uses `MailParser` and file streams. Attachments are written directly with backpressure, and the parser is released after writing completes. The full RFC822 buffer and complete attachment buffer are not allocated together. Existing CID-to-data-URI conversion retains the library's conversion/limits, rereading only required inline images. MIME filenames are never used as storage paths.
- Conversion uses a new staging directory on the same volume. On failure, clean up only task-owned incomplete directories/streams. Preserve existing cache, accounts, mail and original import-ledger format. Concurrent drop requests share one batch to prevent duplicate import.
- Metadata reads are bounded to 32 per request; Maildir source enumeration to four. Date sorting and access filters remain. Metadata/body content is not held in a permanent memory cache. MIME libraries load lazily when viewing only existing message lists.
- Webmail defaults to a 512 MiB V8 old generation and 16 MiB semi-space. These are **not a process-RSS or container-memory limit**. TLS, stream buffers and Argon2's native 64 MiB per operation are additional. Authentication cost was not reduced, and no Docker hard limit was added to force process termination.
- Nginx defaults to two workers and eight upstream keepalive connections per worker. Workers accept `auto` or 1–128. Request/response buffering remains disabled; streaming uploads, timeouts, TLS and audit logs remain.

References: [MailParser stream/release API](https://nodemailer.com/extras/mailparser), [Node.js 24 V8 options](https://nodejs.org/docs/latest-v24.x/api/cli.html#--max-old-space-sizesize-in-mib), [Nginx workers](https://nginx.org/en/docs/ngx_core_module.html#worker_processes).

## Measurements

Separate synthetic data was compared on Docker Desktop Linux ARM64 / Engine 29.9.2 / Node.js 24.22.2. No personal mail was used for load testing. Values are medians from protected local `.agents/performance-20261111/reports/performance-summary.json` and raw trials.

| Metric | Before | Final | Change |
| --- | ---: | ---: | ---: |
| Webmail post-load working set | 1140.6 MiB | 224.8 MiB | About 80.3% lower |
| Nginx post-load working set | 11.9 MiB | 6.4 MiB | About 46.3% lower |
| Inbox p95 latency | 347.8 ms | 241.8 ms | About 30.5% lower |
| Inbox throughput | 39.28 req/s | 37.60 req/s | About 95.7% retained |
| Peak RSS, 32 MiB attachment | 388.2 MiB | 128.9 MiB | About 66.8% lower |
| Processing time, 32 MiB attachment | 600.1 ms | 467.7 ms | About 22.1% lower |

HTTP used 201 cached messages, concurrency eight, the same fixture/CA/accounts, 48 warm-up requests per phase and 96 requests per trial. The baseline had six trials with reordered execution; final r3 had three. Baseline throughput across both phases ranged 30.44–42.75 req/s; final throughput ranged 36.95–38.37 req/s. Other ongoing tasks and GC caused variability, so no throughput improvement or statistical equivalence was claimed. Acceptance required at least 90% throughput and no more than 15% p95 regression; both passed. MIME compared three fresh-process trials per version using the same 32 MiB binary, Node/dependencies and I/O, verifying identical saved byte counts/SHA-256.

Working set is cgroup usage minus inactive file cache. PID 1 RSS/HWM and swap were recorded separately. A cold production RSS was not directly compared with a warmed fixture. These are **results for that workload**, not a global memory minimum for every mailbox size/concurrency. Remeasure large mailboxes or concurrent large-body requests with the same probes before tuning `WEBMAIL_NODE_OPTIONS` and workers.

## Validation

- All 47 unit tests and the production Next.js build passed in the final runtime image. Test scratch stayed inside the authorized workspace through `MAILBOX_TEST_TMP` and `TMPDIR`.
- Five separate fixture volumes and an internal network were used. Starting with 201 cached messages, tests added a 32 MiB attachment, a 49 MiB plain message, concurrent drop import and local held-mail delivery, reaching 205 cached messages. Maildir grew from one to four messages.
- Comparisons covered original accounts/mail/UIDs/read flags, 605 existing Webmail files, ledger, ownership and root:1500/mode 0660 socket. A held queue message remained byte-identical across new-image shutdown/restart, old-image rollback and return to the new image. It was released only to a local recipient at the end.
- The 49 MiB body was parsed and its actual 118,583,803-byte detail response was streamed to completion. Two 32 MiB attachment downloads matched source byte counts/hashes. Unauthenticated and other-account attachment access was rejected.
- Checks covered submission/IMAP without TLS, external relay rejection for anonymous/wrong-password/ordinary accounts, wrong CA/hostname rejection and Secure/HttpOnly/SameSite cookies. Test DATA went only to `fixture.test` recipients.

Reusable probes live in `tests/performance/`. `http-benchmark.mjs` accepts fixture accounts and restricted local endpoints only. `mime-benchmark.mjs` confines I/O to `MAILBOX_PERF_ROOT`. `data-snapshot.mjs` stream-hashes large files without outputting bodies, addresses or account hashes. `compare-snapshots.mjs` defaults to strict comparison including queues. Production `live-queue` mode leaves SMTP running, so it does not require static equality of queue bytes that legitimate delivery may change. It combines fixture held-queue checks with unchanged real SMTP/IMAP IDs/images/StartedAt and volume attachments.

## Final Image Scans

| Role | Project-Specific Tag | Actual Image ID |
| --- | --- | --- |
| Webmail | `mailbox-webmail-ui:memory-20261111-r3` | `sha256:9227e6e4f93c836815b49a7102931059cc9dfdfac11d66abeb0adc5701825d5b` |
| Proxy | `mailbox-webmail-proxy:memory-20261111-r1` | `sha256:87dd5d06d05ebb08fa12b3370b8b921fbf7453003627a9836b84a06bcd92bd78` |

Both final images used Ubuntu 26.04.1. Webmail used Node.js 24.22.2; proxy used Ubuntu security revision `nginx 1.28.3-2ubuntu1.12`. Trivy 0.76.2 used DB UpdatedAt `2026-11-10T19:01:23.081219346Z`, DownloadedAt `2026-11-11T11:06:42.636548Z`. No ignore list, severity filter or ignore-unfixed was used; Java DB was included. OCI index -> ARM64 manifest -> config digest was bound to scanner ImageID and the current daemon image ID.

**HIGH 0 / CRITICAL 0 does not mean zero total findings.** Webmail retained MEDIUM 42 / LOW 4 (36 unique CVEs); proxy retained MEDIUM 34 / LOW 4 (29 unique CVEs), for 84 raw rows total. None had a scanner fixed-version field. Do not confuse duplicate image/package rows with a global distinct-CVE count. This was neither blanket risk acceptance nor resolution of the scheduled Node security release. Unchanged SMTP/IMAP were not replaced or rescanned by this task.

## Builds and Shared Deployment

Build unique project tags without overwriting shared tags. `NODE_IMAGE` accepts a verified Ubuntu 26.04 / Node.js 24 base; if unavailable, build the project fallback first.

The recorded builds predated the later `license_files` build context. For the historical source, the build commands were:

```sh
docker build --build-arg NODE_IMAGE=platform/node24:ubuntu26.04-20261109-r2 \
  -t mailbox-webmail-ui:memory-20261111-r3 -f webmail-ui/Dockerfile webmail-ui
docker build -t mailbox-webmail-proxy:memory-20261111-r1 \
  -f webmail-ui/Dockerfile.proxy webmail-ui
```

For current source, use Bake or provide the license context described in the [container guide](container-packages.md). Rescan and revalidate any rebuild, even with the same tag. Confirm the selected image ID, not just its tag string.

`compose.performance.yaml` is an override added **after** the standalone or shared Compose model. It changes only the two services' images, heap, workers and grace periods, without editing the shared file.

```sh
MAILBOX_PERF_WEB_IMAGE=mailbox-webmail-ui:memory-20261111-r3 \
MAILBOX_PERF_PROXY_IMAGE=mailbox-webmail-proxy:memory-20261111-r1 \
docker compose -p platform -f ../operations/compose.yaml \
  -f compose.performance.yaml config --quiet
```

Under the shared lock, use verified images with `up --no-deps --no-build --pull never`, selecting only the two services. Do not select SMTP/IMAP or other platform services. Later shared deployment must retain the override/tags to preserve these optimized images; recreating only the shared model's old tag can revert them. This task did not overwrite shared tags/configuration.

Configuration:

- `WEBMAIL_NODE_OPTIONS`: default `--max-old-space-size=512 --max-semi-space-size=16`; increase only after validation. Do not change Argon2 cost.
- `NGINX_WORKER_PROCESSES`: default two, `auto` or 1–128; repeat load testing for higher TLS concurrency.

## Locking, Data and Recovery

Hold a real macOS `flock(2)` on the same inode of `/Users/kkkk/Desktop/jskang/03.workspace/01.project/operations/run/deploy.lock`. Verify a separate nonblocking contender fails; retain the lock through replacement, validation, restart and any rollback. Do not delete the lock file.

Protected ignored `.agents/performance-20261111/backups/` uses directories `0700` and files `0600`. Preserve all four actual MailBox inspect records and `runtime.compose.json`, with absolute paths and existing networks/volumes referenced as external. That JSON contains secret environment values: never attach it to Git/PRs. Keep actual container names/networks/ports and all five volumes; do not overwrite shared production with the checkout's standalone model.

Drain proxy with SIGQUIT, then gracefully stop Webmail. With Webmail as the sole account/cache writer, consistently tar-back up those two volumes and verify hashes and all tar headers. SMTP/IMAP continue using Maildir/queue/auth sockets; this is not a static all-volume backup. Do not delete, restore wholesale or recursively chown any of the five volumes. New Webmail mounts original Maildir read-only.

Rollback refs are `mailbox-web:before-memory-20261111` and `mailbox-proxy:before-memory-20261111`. Under the same lock, verify both current IDs/images, gracefully stop and remove **only those two containers**, preserving volumes. Use only protected `runtime.compose.json` to start the previous Webmail with `--no-deps --no-build --pull never`, wait for TLS/SASL readiness, then start the old proxy. Exclude the performance override during recovery. Do not blindly restore tar over current mail/accounts/cache. Preserve the old model's secrets/mounts/networks/ports and compare accounts, mail, UIDs/flags, original cache/ledger, ownership and the real client.

One-time deployment/lock helpers remain ignored in the task directory. Do not rerun completed `deploy.mjs` for recovery. No `down -v`, global prune, other-project stop or arbitrary worktree is permitted.

## Recorded Production Results

Replacement and normal restart completed on 2026-11-11 at **20:55 KST**. Webmail container `d07eb68b06db` and proxy `5b06a2838125` ran the final image IDs above. Both had restart count zero, normal-stop exit zero and no OOM. Webmail PID 1 was UID 5000/capability zero; Nginx had a master and two workers.

Two accounts, five Maildir messages, an empty queue, 21 existing Webmail files, five ledger entries, 150 ownership/mode entries and certificate/CA/service credentials were preserved. The socket was root:1500/mode 0660. All five volume names and original mounts/networks/ports remained. SMTP/IMAP and 12 other-project containers retained ID/image/StartedAt/running state. A probe using the real `damgox2-worker` JVM image/network namespace and read-only CA/credentials verified TLS/hostname/AUTH then QUIT on existing 2587, without MAIL/RCPT/DATA.

Lock inode `25825009` was held through replacement, validation and restart. An initial final-check failure due to `docker top` format compatibility automatically restored the previous images/configuration. A retry using `/proc` verification passed. Raw audit history remains in `deploy-audit.jsonl`.

Consistent account/cache backups are in `backups/volumes-2026-11-11T11-54-21-369Z/`; prefer actual paths and SHA-256 from `reports/backup-inventory.json`. Recovery uses `backups/runtime.compose.json` and the two `before-memory-20261111` refs. `backups/performance.env` and checkout `compose.performance.yaml` reproduce optimized operation. Never commit protected JSON/environment files.

Protected `deployment-summary.json`, `production-final-preserved.json`, `production-restart-web.json`, `production-restart-consumer.json`, `deploy-others-after.json` and `deploy-lock-proof.json` retain results. The authorized GitHub workflow was feature commit/push, independent current-head App approval and required checks, develop merge and branch cleanup. Git-only work without image changes did not replace Docker again.
