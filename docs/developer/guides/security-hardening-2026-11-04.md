# MailBox Mail-Service Security Validation — 2026-11-04

Historical record. Image versions, scan results and process IDs below describe the November 4 validation, before the Ubuntu transition. Translation does not renew the scan or describe today's runtime.

## Image Rescan

Trivy 0.76.1 scanned exact image archives at all severities. No CVE exclusion list, `ignore-unfixed` or severity filter was used. Follow-up scans used `--skip-db-update` with the same database. Results apply only to those images and that database snapshot.

The original target, `sha256:594e743418aadf1ed23478ba448bcb6cad5809c99858ecca9c06e43d7de12c99`, reproduced LOW 102 / MEDIUM 114 / HIGH 33 / CRITICAL 1 / UNKNOWN 1: 251 raw rows. Deduplicating the 34 HIGH/CRITICAL rows by CVE ID yields ten distinct CVEs; grouping by `(installed source package, CVE)` also yields ten findings.

| Final Image | LOW | MEDIUM | HIGH | CRITICAL | UNKNOWN |
| --- | ---: | ---: | ---: | ---: | ---: |
| SMTP | 0 | 0 | 0 | 0 | 0 |
| Webmail | 0 | 0 | 0 | 0 | 0 |
| IMAP | 0 | 0 | 0 | 0 | 0 |
| HTTPS proxy | 0 | 0 | 0 | 0 | 0 |

SMTP moved to Alpine 3.24.3 / Postfix 3.11.7. The application used Next.js 16.4.5, Nodemailer 10.3.1, MailParser 3.14.1 and patched dependencies. Development dependencies and runtime-unnecessary npm/Yarn were excluded. SMTP still needed Node.js for its unprivileged map watcher, which uses built-in modules only.

The IMAP follow-up moved to Alpine 3.24.3 / Dovecot 2.4.5. After reproducing the previous image's HIGH 32 / CRITICAL 1, an all-severity scan of the new image found zero. This follow-up resolved the previously retained high-severity IMAP findings. SMTP and Webmail were rescanned with the same current database.

## Ten High-Severity CVEs in the Original SMTP Image

| CVE | Raw Rows | Installed Configuration and Action |
| --- | ---: | --- |
| CVE-2026-43964 | 1 | Replaced affected Postfix 3.7.11 with fixed 3.11.7. |
| CVE-2023-45853 | 1 | zlib source-package finding; no installed MiniZip binary or vulnerable symbol. |
| CVE-2025-69720 | 3 | Duplicate ncurses source findings. The infocmp CLI issue is distinct from SMTP handling. Absent from the new image's scan. |
| CVE-2026-16742 | 2 | Duplicate libsystemd/libudev source findings. The vulnerable systemd-homed feature was not installed; the new image has no systemd. |
| CVE-2026-41992 | 1 | GNU gzip LZH handling, not invoked by SMTP; absent from the new image's scan. |
| CVE-2026-53613 | 8 | Duplicate util-linux source findings for fstab-based mounting; absent from the new image's scan. |
| CVE-2026-53615 | 8 | Duplicate util-linux source findings for DOS partition probing; absent from the new image's scan. |
| CVE-2026-78410 | 8 | Duplicate util-linux source findings for privileged bind mounting; absent from the new image's scan. |
| CVE-2026-54369 | 1 | libacl pathname API; no libacl dependency in the new image. |
| CVE-2026-9538 | 1 | perl-base source finding; vulnerable Archive::Tar module not installed, and no Perl in the new image. |

The Postfix issue is an out-of-bounds read of an enhanced status code without text. Upstream described access/policy paths, rather than reproduction through SMTP/LMTP server responses. The original configuration used no policy service, milter or DNSBL, so exploitability through Internet SMTP commands alone was not asserted. The affected binary was nevertheless replaced. See the [Debian status](https://security-tracker.debian.org/tracker/CVE-2026-43964) and [Postfix fix announcement](https://www.postfix.org/announcements/postfix-3.11.2.html).

CVE-2023-45853 affects MiniZip's `zipOpenNewFileInZip4_64`, not zlib's core compression API. The exact old image contained only `zlib1g 1:1.2.13.dfsg-1`, without `minizip`, `libminizip1` or `zlib1g-dev`. No MiniZip files under `/usr` or corresponding symbols in installed libz were present. Debian states that bookworm's zlib does not build contrib/minizip, leaving those binaries unaffected. The impact assessment was recorded separately without hiding the scanner's raw result. See the [official Debian assessment](https://security-tracker.debian.org/tracker/CVE-2023-45853).

Other source-package assessments used Debian's trackers for [ncurses](https://security-tracker.debian.org/tracker/CVE-2025-69720), [systemd](https://security-tracker.debian.org/tracker/CVE-2026-16742), [gzip](https://security-tracker.debian.org/tracker/CVE-2026-41992), [util-linux 53613](https://security-tracker.debian.org/tracker/CVE-2026-53613), [53615](https://security-tracker.debian.org/tracker/CVE-2026-53615), [78410](https://security-tracker.debian.org/tracker/CVE-2026-78410), [acl](https://security-tracker.debian.org/tracker/CVE-2026-54369) and [Perl](https://security-tracker.debian.org/tracker/CVE-2026-9538).

## Privileges and Remaining Root Roles

- Initialization permits only CHOWN, DAC_OVERRIDE, FOWNER, SETPCAP, SETUID, SETGID and KILL. Drop all default Docker capabilities.
- Master PID 1: UID 0, CapEff/CapBnd `0x00e2` = DAC_OVERRIDE, KILL, SETGID, SETUID; `NoNewPrivs=1`. Initialization-only CHOWN/FOWNER/SETPCAP do not remain.
- smtpd/qmgr: real/effective/saved UID 100, GID 1500, CapEff 0.
- virtual: idle effective UID 100, with saved root retained to switch to Maildir UID 5000. Fixture Maildir delivery succeeded.
- Map watcher: UID 5010/GID 5000, CapEff/CapBnd 0. Atomic LMDB replacement removed the root reload watcher.
- Public host 25 mapped to container 2525 in this historical configuration. NET_BIND_SERVICE/SYS_CHROOT, unused local/pipe/spawn services and SUID/SGID bits were removed. postqueue/postdrop permission warnings resulted from disabling unprivileged local submission helpers.

Removing DAC_OVERRIDE caused queue/data access failures, so its retention was limited to a demonstrated requirement. Root master and virtual's saved root remained: execution was not fully non-root. **No risk-acceptance approval for these remaining root privileges was assumed or recorded.** Unnecessary privileges were reduced while preserving supported Postfix separation and Maildir delivery. The [Postfix unprivileged-execution guidance](https://www.postfix.org/UNPRIVILEGED_README.html) warns against using its proposed unprivileged mode in production for file/Maildir delivery.

## Submission, Relay and TLS Validation

| Path or Condition | Observed Result |
| --- | --- |
| Separate unauthenticated Docker peer on the old production network -> external RCPT | 250: private-network relay trust was too broad. No DATA sent. |
| New public reception -> nonlocal RCPT | 554 rejection, including a peer on the same private network; AUTH not offered. |
| Public reception -> registered local recipient | 250; STARTTLS offered. |
| Internal submission 2587 before TLS | AUTH not advertised, MAIL rejected with 530; no host-published port. |
| After TLS, unauthenticated or wrong password | External RCPT rejected with 554 / AUTH rejected with 535. |
| After TLS, valid ordinary IMAP account | Authentication succeeded but service relaying was rejected with 554. |
| After TLS, dedicated service account | Submission allowed; fixture Maildir delivery succeeded. |
| Application: missing STARTTLS, handshake failure, untrusted CA or hostname mismatch | All failed without AUTH/MAIL/DATA; valid verified TLS succeeded. |
| Postfix -> test MTA: missing TLS, hostname mismatch or handshake failure | All deferred; no plaintext DATA. |
| Postfix -> test MTA with valid certificate | Verified TLS and successful DATA delivery. |

Public port 25 retained `smtpd_tls_security_level=may` for Internet reception compatibility. The application listener used `encrypt`; its transport used `requireTLS=true`, `rejectUnauthorized=true`, TLS 1.2 or later and an explicit servername. The Dovecot Unix socket was restricted to GID 1500/mode 0660. Only the dedicated service identity could submit, with no private-network trust or sendmail fallback.

Outbound delivery used `smtp_tls_security_level=verify` and `smtp_tls_verify_cert_match=hostname`. A destination failing TLS or MX-host certificate verification was deferred. This repository had no dedicated authentication/recovery-mail feature; future implementations must use the same submission module. See [Postfix TLS policy](https://www.postfix.org/TLS_README.html) and [Dovecot/Postfix SASL](https://doc.dovecot.org/2.3/configuration_manual/howto/postfix_and_dovecot_sasl/).

The old server's Internet open-relay status was not independently established. The demonstrated issue was relay permission for a private-network peer. All test DATA stayed within isolated networks and local Maildir/sinks; no real external recipient received test mail.

## Evidence and Rescanning

Local `.agents/security-hardening/reports/` preserves raw Trivy JSON, image-ID bindings, package lists, unit tests and SMTP authorization/TLS/process checks. Reports and commits exclude passwords, tokens and private keys.

```bash
npm test --prefix webmail-ui
docker compose --env-file .env.example -f docker-compose.prod.yml config --quiet
trivy image --scanners vuln --format json --output <workspace>/reports/smtp.json <exact-image-ID>
```

Rescan the actual image ID after rebuilding or changing tags. Archive `index.json`/`manifest.json` bound runtime manifest IDs to scanner config IDs.

## IMAP Follow-Up and Compatibility

The old IMAP image's 33 HIGH/CRITICAL raw rows represented nine CVEs. Critical MiniZip was assessed as unaffected in that exact image because the relevant binaries/symbols were absent. The remaining ncurses, systemd, GNU gzip, util-linux, libacl and Perl source dependencies were removed from the new image; the same CVEs no longer appeared. Counts were not reduced merely through CVE exclusions or unused-feature labels.

TLS certificates/keys, passwd-file, username variables and Maildir paths moved to Dovecot 2.4 configuration syntax. `dovecot_storage_version=2.3.0` preserved index compatibility for a rollback to 2.3. See the [official migration guide](https://doc.dovecot.org/2.4.1/installation/upgrade/2.3-to-2.4.html) and [storage-version setting](https://doc.dovecot.org/2.4.1/core/summaries/settings.html#dovecot_storage_version).

A read-only copy of production volumes and isolated fixtures verified:

- Existing UIDVALIDITY, UIDs, message count and read flags across 2.3 -> 2.4 -> 2.3 rollback -> 2.4.
- Rejection of IMAP login before TLS; successful certificate/hostname-verified STARTTLS and existing BLF-CRYPT login.
- Postfix SASL using a copied existing service account; rejection of ordinary/unauthenticated relaying, dedicated-account submission and Maildir delivery.
- New configuration with `doveconf -n`, plus account hashes and original Maildir message SHA-256 comparisons before/after replacement.

Local `.agents/imap-hardening/reports/` preserves follow-up raw scans and compatibility evidence. Full ICU data supports Korean search and legacy character sets; separate fixtures verified UTF-8 subjects and EUC-KR body search.

## HTTPS Proxy Follow-Up

The old Caddy 2.11.7 image also had raw HIGH 9 / CRITICAL 1, representing seven distinct CVEs across Brotli, curl, Go's standard library, x/net and go-jose v3/v4. The available current Caddy image retained those dependencies, and an official upstream 2.11.8 container was not yet available at the time. Its source still depended on go-jose v3 without a fixed version, so changing a version number alone was insufficient. See the [Caddy release](https://github.com/caddyserver/caddy/releases/tag/v2.11.8) and [go-jose advisory](https://github.com/go-jose/go-jose/security/advisories/GHSA-mgcc-cww5-fp2q).

The required explicit-certificate HTTPS reverse proxy and HTTP 308 redirect moved to Nginx 1.30.6. The updated Alpine proxy's all-severity rescan found zero. Existing public ports, certificates, backend and read-only execution were preserved; generated runtime configuration and temporary files used tmpfs only.

Isolation checks covered URI/query-preserving 308 redirects, verified HTTPS, rejection of wrong hostnames/chains, login/inbox and Secure/HttpOnly/SameSite cookies. The proxy replaced client-supplied X-Forwarded-For with the real peer IP. New proxy access logs used JSON without passwords, cookies, authentication headers or message bodies.

## Image binding evidence

DB UpdatedAt: `2026-11-04T01:28:23.13686565Z`

```json
{
  "imap-mailbox": {
    "runtimeImageId": "sha256:df3e0026834877a66540c188725291406fe9a9f5d01b49fd3f65e75ddd2f7fa7",
    "scanImageId": "sha256:59adfbf5da17d5c10684a612bcceebbddf74fe5c5c82f557054c712abcc28dbc",
    "severity": {},
    "reportSha256": "e23ce20fee7666dfaf3845cca63382e75f94ba31d7b242dbab299ee10f1679b8"
  },
  "smtp-receiver": {
    "runtimeImageId": "sha256:a2392bb2ab623efe485b6a3e9abc956aebc3930130b1350d73f8fe8a1d1df1ad",
    "scanImageId": "sha256:45a9ca8f8e068a5050adf4eb007b42ac31e406cc922864b3996e9850ed85d03f",
    "severity": {},
    "reportSha256": "a6d1794df50babd38d0597adf9e0bb1f921cb6427c0a6efe6964fb33c0f44099"
  },
  "webmail-ui": {
    "runtimeImageId": "sha256:d0e3dabbda041a499437791f6f489a402271c5e5e02225497f8cafd03d13003a",
    "scanImageId": "sha256:fc3fb52adccd53c95f902e91ea021a3b8b60ac9386e7772ecb0116e7b34485c6",
    "severity": {},
    "reportSha256": "60604379831e89caf19f8c292550902040fd4be3496a19a00857c2dbf6040e43"
  },
  "webmail-proxy": {
    "runtimeImageId": "sha256:3482c6278f61c681bc53ca09a8dc79b24738888b986fe5575ff889bfc275dc9b",
    "scanImageId": "sha256:d592077708298f957acd477bcd3b085e341993bebb91abac0b3537a67090fd1a",
    "severity": {},
    "reportSha256": "81330fbed29a5d448f502c5a3419ca5bbf319bb10c71fb6e558c6d9eca082764"
  }
}
```
