# Security Image Validation Record — 2026-11-09

Build/scan baseline: 2026-11-09 KST. This historical record describes candidate validation and deployment conditions, before the Ubuntu transition. Confirm actual operating image IDs and before/after state separately; translation does not renew the scan.

## Authorization and Changes

The user authorized image rebuilds/rescans from the security investigation, one independent reviewer, develop/main integration and operating-container replacement. Password length was separately set to **8–128 characters**. Existing accounts, passwords, mail, queues and certificates were to be preserved.

- All four runtime Dockerfiles gained an Alpine stable `zlib>=1.4-r0` floor; builds fail if it is unavailable.
- The candidate Webmail incorporated main's account-ownership verification, dot-directory ID rejection, NUL rejection, interrupted-provisioning recovery and verification of existing SMTP service accounts before attempting signup.
- New accounts use Dovecot-compatible Argon2id to support the requested length without bcrypt's 72-byte truncation. Native Node crypto applies PHC v19, 64 MiB memory, three passes, parallelism one, 16-byte salt and 32-byte tag. Webmail accepts only this fixed profile. Existing BLF-CRYPT hashes are verified without rewriting.
- Length retains JavaScript string and HTML min/maxLength semantics. A 128-character Korean password is accepted without imposing a smaller UTF-8 byte limit. NUL is prohibited by the shared SASL authentication format.

## Finding Assessment

| Item | Evidence and Action |
| --- | --- |
| CVE-2026-4738 | Four MEDIUM rows across the four old images, one unique CVE. The vulnerable target was contrib/infback9; the installed OS libz had no corresponding implementation/package/export, so that attack path was not demonstrated. Updated to zlib 1.4-r0 without suppressing the finding. |
| Additional zlib 1.4 security fixes | Upstream also announced buffer/boundary fixes in ordinary libz; included in the same update. Previous Alpine 1.3.2-r1 already backported CVE-2026-85091, so it was not counted again as unpatched. |
| Source/runtime mismatch | Previously merged account-protection code was absent from the running image. The candidate included it; hashes of six core server modules were compared with source. |
| November Node.js security release | Advance notice scheduled HIGH fixes for November 11 or later. CVEs, conditions and fixed versions were not published at the time, so this remained **unresolved/pending**. A follow-up must assess actual impact and fixed versions and obtain the required approval after publication. |

Next.js 16.4.5 was the fixed version for the October 14 RCE and November 3 advisory. Advisories for Nodemailer 10.3.1, Postfix 3.11.7, Dovecot 2.4.5 and Nginx 1.30.6 were also checked. This did not guarantee the absence of unknown zero-days.

## Candidate Images and Scans

Trivy 0.76.1; vulnerability DB UpdatedAt `2026-11-08T18:58:44.715199225Z`, downloaded `2026-11-08T20:24:39.74629175Z`. Archive config digests were bound to scanner metadata; no ignore list, severity filter or ignore-unfixed was used. Candidates ran Alpine 3.24.4 with zlib 1.4-r0. Scans covered runtime OS and detectable language packages. Zero below means **no findings in that database snapshot**, not resolution of unpublished Node fixes.

| Module | Docker Image ID | All-Severity Findings |
| --- | --- | --- |
| SMTP | `sha256:ae6321ebd5f670a5f6b3d7d76ed80246b0f3a39c04bd0ca70937f12f63562390` | 0 |
| IMAP | `sha256:e1f102b5ecc5a5bb5ef1b6342569b3652bc8e230c15aff755fa8c52646ef6c36` | 0 |
| Proxy | `sha256:8fbebeccfd2d227613519d88b9e294e76cfac83144ad97af680f2dc8721d67db` | 0 |
| Webmail | `sha256:33ee7e0bba4114eddde1e6d554d426620cc7dbe9832321c09be44ff8c4ff3e17` | 0 |

Ignored `.agents/security-rollout-2026-11-09/reports/` contains raw scans, DB metadata, config/image bindings, module hashes, account-compatibility summaries and integration results. Earlier investigation evidence is in `.agents/security-news-2026-11-08/reports/`. Never attach real account hashes, passwords or message bodies to this document or a PR.

## Validation Results

- All 33 Webmail unit tests passed, including random Argon2id salts, final-character verification for long ASCII/Korean passwords, legacy bcrypt compatibility, length/NUL/cost-profile rejection and account recovery.
- Four image builds and the production Next.js build passed. Four existing mailStore file-tracing warnings remained. Development/production Compose validation passed.
- A fixture separate from production volumes passed 29 password checks: signup with 8-character, 128-character ASCII and 128-character Korean passwords; Webmail and certificate/hostname-verified IMAP STARTTLS login; wrong-last-character rejection; and existing bcrypt Webmail/IMAP login with unchanged hashes. IMAP checks waited briefly for account-file refresh.
- All 22 SMTP checks passed: public STARTTLS/local reception, no public AUTH, rejection of private-network external relaying, mandatory TLS before submission, rejection of anonymous/wrong-password/ordinary-user relaying, and dedicated service TLS/AUTH submission. External-recipient checks ended with RSET/QUIT after RCPT; actual DATA stayed inside the fixture.
- IMAP rejected plaintext login and preserved UIDVALIDITY, UIDs, Seen and message count across restart. HTTPS checks covered URI/query-preserving redirects, rejection of certificate/hostname mismatch, login/inbox and Secure/HttpOnly/SameSite cookies.

## Deployment and Recovery Conditions

Integrate into develop/main only after independent current-head review and the required check. Immediately before deployment, stop only MailBox, create a consistent mode `0600` backup of all five volumes, and preserve previous image IDs under rollback tags. Compare account-row hashes, message hashes, UIDVALIDITY and queue files; restart only with the exact scanned images. Record actual production results in the ignored deployment evidence.

On failure, inspect preserved images and volume state first. A Webmail rollback without Argon2id support cannot authenticate new Argon2id accounts; suspend signup and use compatible images/backups together. Never change existing account hashes merely because of deployment/login. Do not weaken root-role/capability separation, relay trust or TLS verification. See [Operation](operation.md).

## Official References

- [zlib 1.4 release and security fixes](https://zlib.net/)
- [Alpine 3.24 zlib build and secfixes](https://raw.githubusercontent.com/alpinelinux/aports/3.24-stable/main/zlib/APKBUILD)
- [November 2026 Node.js security-release advance notice](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)
- [Node.js 24 crypto.argon2 API](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback)
- [Dovecot password-hash formats](https://doc.dovecot.org/2.4.1/core/config/auth/schemes.html)
- [Next.js security advisories](https://github.com/vercel/next.js/security/advisories)
- [Nodemailer security advisories](https://github.com/nodemailer/nodemailer/security/advisories)
