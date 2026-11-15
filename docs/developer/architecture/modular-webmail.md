# Modular Webmail

MailBox keeps SMTP, IMAP and Webmail as top-level executable modules. Webmail uses native Node.js ESM for backend code and Next.js Server Components for request rendering. React client components handle navigation selection, compose interaction and HTML mail sizing.

## Identity

The intended organization domain is `gg-jskang.xyz`. Its normalized reverse-domain namespace is `xyz.gg_jskang`, and the project namespace is `xyz.gg_jskang.mailbox`. This is a source identity convention; registration, DNS, certificate and mail-domain migration are separate operations.

The private Node package is `@gg-jskang/mailbox-webmail-ui`. npm scope ownership must be verified before any public registry publication. Future JVM modules use group `xyz.gg_jskang` and artifacts `mailbox-<module>`. The existing Java protocol probe uses `xyz.gg_jskang.mailbox.probe`; it remains a standalone Java 17-compatible probe, without a new Maven/Gradle application.

Existing GHCR paths, Compose names, volumes, ports and service account IDs remain compatibility contracts.

## Dependency direction

```text
Browser -> HTTPS proxy -> server.mjs
  /api/* -> backend/http -> backend/application -> domain and adapters
  pages  -> src/app -> src/server -> backend/application
                   -> feature view models -> shared/feature components

backend/infrastructure -> filesystem, SMTP and MIME libraries
backend/ingestion      -> source policies, message repository and ledger
```

`server.mjs` owns HTTP startup and graceful shutdown. `backend/bootstrap/create-services.mjs` wires native HTTP dependencies. `src/server/services.ts` is the Next-only composition root and imports `server-only`. Server pages call services directly rather than their own HTTP endpoints. The SSR ingestion coordinator is process-local and is not instantiated in the HTTP composition root. Keep one Webmail writer; this design does not authorize multi-process writers.

Native ESM uses explicit `.mjs` imports and no Next aliases. Public contracts used by TypeScript have `.d.mts` declarations. CLI compatibility exports at the Webmail root preserve existing operator/probe imports. Docker explicitly ships `backend/`; native custom-server code is not automatically compiled by Next.

## Backend patterns

- Service Layer: authentication, registration, authorized mailbox queries, sending and attachment resolution.
- Repository: account transaction files, sent messages, imported message reads and import ledger.
- Strategy: Argon2id and legacy bcrypt verification; legacy scrypt ownership proof; Maildir and drop source handling.
- Adapter: mandatory verified SMTP submission, streaming MIME parsing and transport-specific HTTP handlers.

Account provisioning retains the existing two-file journal, lock, recovery and unrelated-edit conflict refusal as one consistency boundary. Do not split account and recipient updates into independent repositories. Passwords remain 8–128 characters under the existing validation semantics. New hashes use Argon2id; existing bcrypt hashes are preserved. Service provisioning checks the real socket peer, never forwarded headers.

The message repository retains `mail/{inbox,sent,bounced}/<id>/{meta.json,body.txt,body.html,attachments/}`. MIME attachments stream to generated names, never MIME filenames. Maildir comparison identities tolerate new/cur moves and Seen flags while the ledger retains raw keys readable by earlier releases. Source discovery stays bounded at four; metadata reads at 32. Maildir HTML/CID handling and drop plain-text rendering intentionally remain source-specific.

Path segments reject `.` and `..`; attachment resolution verifies the real file path stays under the attachment directory. Signed sessions and the same ownership policy protect lists, details, attachments and sending. HTTP response status differences are transport decisions, not separate ownership policies.

## Frontend composition

| Area | Components / model | Runtime |
| --- | --- | --- |
| Shared UI | PageHeader, FormField, StatusMessage, EmptyState | Server-renderable; also usable in a client subtree |
| Layout | AppShell, TemporalEmblem, AppNavigation | Server shell with small client navigation |
| Authentication | AuthShell, LoginForm, SignupForm, auth-errors | Server; native POST forms |
| Mailboxes | MailboxPage, MailboxView, MailList, MailRow, mailbox-config, mail-list-view | Server |
| Message detail | MessageHeader, MessageBody, AttachmentList, message-detail-view | Server |
| HTML mail | MailHtmlFrame, useMailFrameSize, frame-document | Client island |
| Compose | ComposeForm, AttachmentPicker | Client; native multipart POST |

Primitives use explicit props and composition, preserving label associations, form field names, autocomplete, native validation and responsive CSS selectors. The existing theme and Korean UI remain. Compose stores only a pending flag and selected filename strings, not file bytes. No global state or client data-fetching framework is required.

HTML mail remains sandboxed without `allow-scripts`, with `no-referrer`, protected external links and a 240–16000 pixel sizing clamp. The hook disconnects observers and clears timers, animation frames and image listeners on rebind/unmount. Never render raw HTML directly in the parent document.

## Logging and failure semantics

All application audit records are JSON Lines with INFO/WARN/ERROR and dotted events. HTTP context and Next header adapters share one serializer. Error objects retain safe type/code information rather than raw messages/stacks that could contain credentials. SMTP error codes remain allowlisted. Never add message bodies, attachment bytes, passwords or session material to logs.

Multipart writers settle before caller cleanup on parse, limit, disconnect or file errors. Attachment responses use a stream pipeline and terminate on source/client failure. SMTP submission never falls back to plaintext or sendmail.

SMTP acceptance and sent-file persistence remain separate outcomes. A persistence failure after acceptance is logged with `deliveryAccepted`; automatic retry would risk duplicate delivery and is not performed. Maildir import ledger persistence is batch-based: crash-safe exactly-once import is not guaranteed. Neither refactoring nor displaying a message adds Webmail-to-IMAP Seen synchronization.

The existing UI upload limit is 1 GiB, while Postfix caps total messages at 50 MiB, including MIME overhead. This refactor does not raise the MTA limit. A consistent user-facing limit requires a separate policy change.

## Validation

Run from the checkout root, directing temporary files and caches into an owned ignored task directory:

```bash
MAILBOX_TEST_TMP=<absolute-workspace-task>/tmp npm test --prefix webmail-ui
NEXT_TELEMETRY_DISABLED=1 npm run build --prefix webmail-ui
node --test tests/release/registry.test.mjs tests/release/promotion.test.mjs
```

The unit suite includes native services, access/path boundaries, SMTP failure/persistence separation, multipart cleanup and client import boundaries. Existing account crash-recovery, password, MIME and identity cases remain.

Build with a unique local image tag and the verified Ubuntu Node 24 base. `tests/release/unit.mjs` tests shipped backend code while mounting test/source files read-only. `tests/release/smoke.mjs` uses exact uniquely named fixture resources and an internal mail network. Its proxy alone has a separate browser-edge network and a loopback ephemeral HTTPS port. It never sends to an external real recipient.

Optional extended checks:

```bash
CHECK_DIR=<absolute-workspace-task> TAG=<candidate-tag> \
MAILBOX_BROWSER_CHECKS=1 MAILBOX_REGRESSION_CHECKS=1 \
MAILBOX_BASELINE_WEB_IMAGE=<preserved-old-web-image> \
TMPDIR=<absolute-workspace-task>/tmp node tests/release/smoke.mjs
```

Install the pinned development-only browser test dependency with a workspace-local npm cache. Set `MAILBOX_CHROME` if Chrome is not at the macOS default path; browser profiles and output stay within `TMPDIR` and the task reports directory. Browser tests cover signup/login/logout, common views, local send/attachment download, cross-user denial, HTML sandbox/resize lifecycle, mobile layout and reduced motion.

Regression checks preserve a real held queue file and compare account entries, message hashes, UID mappings, flags, web data and ledger before/after old-image rollback, candidate return and restart. Resource comparisons record repeated identical request workloads and process RSS high-water values; interpret small fixture measurements within their recorded limits.

## Rollback and delivery

No persistent format migration is required. Preserve the previous image digest and exact deployed configuration before an authorized rollout. Gracefully replace only MailBox services under the shared deployment lock, retaining all five existing volumes and ownership. Verify TLS/auth, web pages, queue and client connections. On failure restore the old image/configuration against the current persistent data; do not overwrite newly received mail with an old snapshot.

Production deployment, public package publication and runtime DNS migration require their applicable authorization and evidence. A successful local build or isolated test does not itself prove production deployment. Use the guarded GitHub workflow for commits, pushes, review and merges; published immutable version tags must never be replaced.
