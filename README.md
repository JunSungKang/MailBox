# MailBox

**Self-hosted SMTP, IMAP and webmail with persistent Maildir storage.**

[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.1-green.svg)](VERSION)
[![Containers](https://github.com/JunSungKang/MailBox/actions/workflows/publish-containers.yml/badge.svg?branch=main)](https://github.com/JunSungKang/MailBox/actions/workflows/publish-containers.yml)

MailBox is a single-host mail server that combines Postfix, Dovecot and Next.js Webmail in Docker. Create an account, read and send mail in the browser, or access the original mailbox through an IMAP client.

## Contents

[Features](#features) · [Architecture](#architecture) · [Packages](#container-packages) · [Getting started](#getting-started) · [Development](#development) · [Documentation](#documentation) · [Contributing](#contributing) · [License](#license)

## Features

- SMTP reception, Maildir delivery, IMAP STARTTLS, Webmail, message composition and attachments.
- Public signup with a user ID and an 8–128-character password, with protection for existing accounts and address ownership.
- Salted Argon2id for new accounts and compatibility with existing BLF-CRYPT hashes.
- Mandatory STARTTLS, CA/hostname verification and dedicated SASL authentication for application submission.
- Per-user message and attachment authorization, with JSON Lines audit logs that exclude secrets.
- Streaming attachments, bounded file I/O concurrency and configurable memory/worker settings.
- Ubuntu 26.04 runtimes and a shared Node.js 24 base for Webmail and SMTP tooling.

## Architecture

```text
Internet SMTP -> Postfix -> original Maildir -+-> Dovecot -> IMAP client
                                            +-> Webmail import -> body/metadata/attachments
Browser -> HTTPS proxy -> Webmail
Webmail -> verified STARTTLS + SASL -> Postfix -> destination mail server
```

Messages are stored as files in Docker named volumes. No separate relational database is required.

| Volume | Purpose |
| --- | --- |
| `mailbox-store` | Per-user original Maildirs and IMAP state |
| `webmail-data-store` | Webmail bodies, metadata, attachments and sent mail |
| `mailbox-account-store` | Account hashes and authoritative recipient maps |
| `smtp-queue-store` | Processing and delivery queues |
| `smtp-auth-store` | Shared SMTP/IMAP authentication socket |

## Container Packages

The existing `mail-server-*` registry names are retained for compatibility. The current patch release is `v0.2.1`. Version and `sha-<full-commit-SHA>` tags are immutable under the publisher; only `latest` moves to a new release. Pin a version or digest for deployment and rollback. The November 15 `v0.2.0` build introduced the Ubuntu transition, memory improvements, signup without invitation codes and account-boundary protections. Review the [data, UID/GID, TLS and rollback procedure](docs/developer/guides/ubuntu-platform-transition.md) before upgrading an older installation.

| Service | Image | Package Versions |
| --- | --- | --- |
| SMTP | `ghcr.io/junsungkang/mail-server-smtp-receiver:v0.2.1` | [Versions](https://github.com/JunSungKang/MailBox/pkgs/container/mail-server-smtp-receiver/versions) |
| IMAP | `ghcr.io/junsungkang/mail-server-imap-mailbox:v0.2.1` | [Versions](https://github.com/JunSungKang/MailBox/pkgs/container/mail-server-imap-mailbox/versions) |
| Webmail | `ghcr.io/junsungkang/mail-server-webmail-ui:v0.2.1` | [Versions](https://github.com/JunSungKang/MailBox/pkgs/container/mail-server-webmail-ui/versions) |

Releases provide `linux/amd64` and `linux/arm64`. `latest` identifies the validated main release; `sha-<full-commit-SHA>` identifies its source revision. Check the publication workflow's final digests rather than assuming a mutable tag identifies a particular build. See the [build, validation and publication guide](docs/developer/guides/container-packages.md).

The pre-publication baseline and subsequent checks confirmed that the visible `v0.1.x` tags and November 15 `v0.2.0` digests were preserved during `v0.2.1` publication. These checks do not establish the identity or restoration of a reported months-old `0.2.0` image; that historical original has not been identified.

## Getting Started

Requirements: Docker Engine/Desktop, Compose 2.17 or later, Buildx/Bake, DNS and TLS certificates, and a network that permits mail traffic. Standalone Bake defaults to `linux/arm64`; explicitly override its target platforms for AMD64, or use the published multi-platform images. Prepare the source and configuration:

```bash
git clone https://github.com/JunSungKang/MailBox.git mail-box
cd mail-box
cp .env.example .env
```

Follow the [installation guide](docs/developer/guides/installation.md) to configure the session secret, SMTP credentials, domains, server certificates and public CA bundle. A new installation also needs ownership prepared for five external volumes and the `platform_default` and compatibility networks. Preserve an existing `.env`, messages, accounts, queues and certificates.

```bash
docker buildx bake -f docker-bake.hcl
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

For actual startup or replacement, follow the [operating procedure](docs/developer/guides/operation.md), including locking, backup, explicit service selection, validation and rollback. To use published images, set the corresponding Compose service images to the addresses above. Configure HTTPS with a shared gateway or the supplied proxy Dockerfile.

| Endpoint | Standalone Compose Default |
| --- | --- |
| Web HTTP / HTTPS | `20005:80` / `20006:443` |
| API | `/api/` on the same HTTPS endpoint; diagnostic access only at `127.0.0.1:20105` |
| SMTP / IMAP | `25` with STARTTLS / `143` with mandatory STARTTLS |
| Application submission | Internal `587`; compatibility `2587` retained during transition |

Installations using a shared edge may have different public URLs. The transition guide describes compatibility for existing `2525`/`2587` consumers and preservation of all five volumes.

## Development

Use Node.js 24 with native `crypto.argon2` support. Dockerfiles pin the deployed version.

```bash
cd webmail-ui
npm ci
npm test
npm run build
```

See [tests/platform](tests/platform/README.md) for isolated SMTP/IMAP/Webmail validation and the [container guide](docs/developer/guides/container-packages.md) for package checks. Fixtures use dedicated accounts, networks, volumes and local mail only.

```text
smtp-receiver/   Postfix configuration and account-map watcher
imap-mailbox/    Dovecot configuration and Maildir access
webmail-ui/      Next.js UI, authentication, file storage and submission
platform/       Ubuntu-based shared Node image build
tests/          Unit, isolated platform and package validation
docs/           Installation, operations and architecture
```

## Documentation

- [Documentation index](docs/README.md) · [Developer guide](docs/developer/README.md)
- [System architecture](docs/developer/architecture/system-architecture.md)
- [Installation](docs/developer/guides/installation.md) · [Operation](docs/developer/guides/operation.md) · [Troubleshooting](docs/developer/guides/troubleshooting.md)
- [User guide](docs/developer/guides/user-guide.md)
- [Memory and performance](docs/developer/guides/performance-2026-11-11.md) · [Signup and account protection](docs/developer/guides/open-signup-2026-11-15.md)

## Contributing

Report bugs and feature proposals through [Issues](https://github.com/JunSungKang/MailBox/issues), and submit code contributions through pull requests. Include the scope, reproduction steps and validation results. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Maintain documentation and release notes in English.

Never include message bodies, credentials, tokens, account data or private keys in public issues, logs or PRs. TLS, ownership and data preservation are contracts that every relevant change must verify.

## License

**GNU Affero General Public License v3.0 only — `AGPL-3.0-only`.** See [LICENSE](LICENSE) for the full terms and [NOTICE](NOTICE) for copyright and third-party notices. This applies to MailBox source and build definitions; external dependencies and operating-system packages retain their respective licenses.

Published images include the license and source revision. The Webmail footer's source-code link provides a public source archive for that exact revision. Distributors of modified versions must also provide the corresponding source and build/installation information as required by the license.
