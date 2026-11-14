# MailBox

**Self-hosted SMTP, IMAP and webmail with persistent Maildir storage.**

[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-green.svg)](VERSION)
[![Containers](https://github.com/JunSungKang/MailBox/actions/workflows/publish-containers.yml/badge.svg?branch=main)](https://github.com/JunSungKang/MailBox/actions/workflows/publish-containers.yml)

MailBox는 Postfix, Dovecot, Next.js 웹메일을 Docker로 구성한 단일 호스트용 메일 서버입니다. 웹에서 계정을 만들고 편지를 읽거나 보내며, IMAP 클라이언트로 같은 원본 메일함에 접속할 수 있습니다.

## Contents

[Features](#features) · [Architecture](#architecture) · [Packages](#container-packages) · [Getting started](#getting-started) · [Development](#development) · [Documentation](#documentation) · [Contributing](#contributing) · [License](#license)

## Features

- SMTP 수신·Maildir 배달·IMAP STARTTLS·웹메일 조회·작성·첨부파일
- 아이디와 8~128자 비밀번호로 공개 가입, 기존 계정·메일 주소 소유권 보호
- 신규 Argon2id 해시와 기존 BLF-CRYPT 계정 호환
- 발송의 필수 STARTTLS·CA/호스트 검증·전용 SASL 인증
- 사용자별 메일·첨부 접근 검사와 비밀값을 제외한 JSON Lines 감사 로그
- 첨부 스트리밍과 제한된 파일 I/O 동시성, 조정 가능한 메모리·worker 설정
- Ubuntu 26.04 런타임과 공통 Node.js 24 기반 웹메일·SMTP 도구

## Architecture

```text
외부 SMTP → Postfix → Maildir 원문 ─┬→ Dovecot → IMAP 클라이언트
                                  └→ 웹메일 가져오기 → 본문·메타·첨부 파일
브라우저 → HTTPS proxy → 웹메일
웹메일 → 검증된 STARTTLS + SASL → Postfix → 상대 메일 서버
```

메일은 Docker named volume에 파일로 저장하며 별도 관계형 DB는 필요하지 않습니다.

| 볼륨 | 용도 |
| --- | --- |
| `mailbox-store` | 사용자별 Maildir 원문과 IMAP 상태 |
| `webmail-data-store` | 웹 조회용 본문·메타·첨부, 보낸메일 |
| `mailbox-account-store` | 계정 해시·수신 주소 원본 |
| `smtp-queue-store` | 처리·배달 대기 큐 |
| `smtp-auth-store` | SMTP/IMAP 인증 소켓 공유 |

## Container packages

레지스트리 호환성을 위해 기존 `mail-server-*` 이름과 `v0.1.x` 태그를 유지합니다. `v0.2.0`은 Ubuntu 전환·메모리 최적화·코드 없는 가입·계정 경계 보호를 포함합니다. 기존 버전에서 전환할 때는 [데이터·UID/GID·TLS·복구 절차](docs/developer/guides/ubuntu-platform-transition.md)를 먼저 확인하세요.

| 서비스 | 이미지 | 패키지 |
| --- | --- | --- |
| SMTP | `ghcr.io/junsungkang/mail-server-smtp-receiver:v0.2.0` | [Versions](https://github.com/users/JunSungKang/packages/container/package/mail-server-smtp-receiver) |
| IMAP | `ghcr.io/junsungkang/mail-server-imap-mailbox:v0.2.0` | [Versions](https://github.com/users/JunSungKang/packages/container/package/mail-server-imap-mailbox) |
| 웹메일 | `ghcr.io/junsungkang/mail-server-webmail-ui:v0.2.0` | [Versions](https://github.com/users/JunSungKang/packages/container/package/mail-server-webmail-ui) |

릴리스는 `linux/amd64`·`linux/arm64`를 제공합니다. `latest`는 검증된 main 릴리스, `sha-<전체 커밋 SHA>`는 해당 소스 버전입니다. 운영에서는 버전 또는 digest를 고정해 사용하세요. 실제 게시 상태와 digest는 workflow 결과에서 확인합니다. [빌드·검증·게시 안내](docs/developer/guides/container-packages.md)를 참고하세요.

## Getting started

필요 환경은 Docker Engine/Desktop, Compose 2.17 이상, Buildx/Bake, DNS·TLS 인증서와 메일 송수신을 허용하는 네트워크입니다. 아래는 소스 빌드와 설정 검증 단계입니다.

```bash
git clone https://github.com/JunSungKang/MailBox.git mail-box
cd mail-box
cp .env.example .env
```

[설치 안내](docs/developer/guides/installation.md)에 따라 세션 secret·SMTP 자격·domain·인증서와 공개 CA를 설정합니다. 신규 설치에서는 다섯 external volume의 소유권과 `platform_default`·호환 네트워크 준비가 필요합니다. 기존 `.env`·메일·계정·큐·인증서는 보존합니다.

```bash
docker buildx bake -f docker-bake.hcl
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

실제 기동·교체는 [운영 안내](docs/developer/guides/operation.md)의 잠금·백업·서비스 선택·검증·복구 절차를 따릅니다. 게시 이미지를 사용하려면 해당 Compose 서비스 image를 위 주소로 지정합니다. HTTPS는 공통 gateway 또는 함께 제공된 proxy Dockerfile로 구성합니다.

| 경로 | standalone Compose 기본값 |
| --- | --- |
| 웹 HTTP / HTTPS | `20005:80` / `20006:443` |
| API | 같은 HTTPS의 `/api/`; 진단만 `127.0.0.1:20105` |
| SMTP / IMAP | `25` STARTTLS / `143` 필수 STARTTLS |
| 앱 SMTP 제출 | 내부 `587`; 전환용 `2587` 유지 |

공통 edge를 사용하는 설치는 공개 URL이 다를 수 있습니다. 기존 `2525`/`2587` 소비자 연결과 볼륨 유지 방법은 전환 문서에 있습니다.

## Development

Node.js 24의 `crypto.argon2` 지원 버전을 사용합니다. 배포 버전은 Dockerfile에 고정합니다.

```bash
cd webmail-ui
npm ci
npm test
npm run build
```

SMTP·IMAP·웹메일의 격리 검증은 [tests/platform](tests/platform/README.md), 패키지 검증은 [게시 안내](docs/developer/guides/container-packages.md)를 참고하세요. fixture는 전용 계정·네트워크·볼륨과 로컬 메일만 사용합니다.

```text
smtp-receiver/   Postfix 설정과 계정 map 감시기
imap-mailbox/    Dovecot 설정과 Maildir 접근
webmail-ui/      Next.js 화면, 인증, 파일 저장과 발송
platform/       Ubuntu 기반 공통 Node 빌드
tests/          단위·격리·패키지 검증
docs/           설치·운영·아키텍처
```

## Documentation

- [문서 시작점](docs/README.md) · [개발자 온보딩](docs/developer/README.md)
- [시스템 아키텍처](docs/developer/architecture/system-architecture.md)
- [설치](docs/developer/guides/installation.md) · [운영](docs/developer/guides/operation.md) · [장애 대응](docs/developer/guides/troubleshooting.md)
- [사용자 안내](docs/developer/guides/user-guide.md)
- [메모리·성능 검증](docs/developer/guides/performance-2026-11-11.md) · [가입·계정 보호](docs/developer/guides/open-signup-2026-11-15.md)

## Contributing

버그·기능 제안은 [Issues](https://github.com/JunSungKang/MailBox/issues), 코드 기여는 Pull Request로 받습니다. 변경 범위·재현 방법·검증 결과를 함께 적어 주세요. [기여 안내](CONTRIBUTING.md)와 [작업 규칙](AGENTS.md)을 확인하세요.

메일 본문·자격·토큰·계정 데이터·개인키는 공개 Issue, 로그, PR에 포함하지 않습니다. TLS·소유권·데이터 보존은 변경 시 확인해야 하는 계약입니다.

## License

**GNU Affero General Public License v3.0 only — `AGPL-3.0-only`.** 전체 조건은 [LICENSE](LICENSE), 저작권과 외부 구성요소 고지는 [NOTICE](NOTICE)에 있습니다. MailBox 소스·빌드 정의에 적용하며 외부 의존성과 운영체제 패키지는 각 라이선스를 유지합니다.

게시 이미지에는 라이선스와 source revision이 포함됩니다. 웹 화면의 **소스코드** 링크는 해당 revision의 공개 소스 archive를 제공합니다. 수정 버전을 배포할 때도 대응하는 소스와 빌드·설치 정보를 제공하세요.
