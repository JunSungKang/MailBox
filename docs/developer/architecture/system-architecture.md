# MailBox System Architecture

문서 최신화 기준일: 2026-11-04

## 모듈 경계

- `smtp-receiver`: 인터넷 SMTP 요청을 받아 Postfix가 Maildir에 배달한다.
- `imap-mailbox`: 같은 Maildir volume을 Dovecot IMAP으로 제공한다.
- `webmail-ui`: Maildir을 읽어 자체 메일 저장소로 가져오고 SMTP 수신기에 발송을 요청한다.
- 운영 `mailbox-webmail-proxy`: `webmail-ui/nginx.conf.template`을 사용하는 Nginx 컨테이너로 Webmail HTTPS 연결을 처리한다.

각 모듈은 자신의 Dockerfile과 설정을 소유한다. 루트 Docker Compose만 모듈 사이의 네트워크, volume, 포트와 환경변수를 조립한다.

| 모듈 | 공개 port | 입력 | 출력 |
| --- | --- | --- | --- |
| `smtp-receiver` | `25` | SMTP, 수신 주소 map | Maildir, Postfix queue/log |
| `imap-mailbox` | `143` | Maildir | IMAP mailbox |
| `webmail-ui` | 내부 `3000`, 운영 진단 loopback `20105` | HTTP, Maildir read, SMTP transport | HTML, Webmail data, SMTP submission |
| 운영 HTTPS 프록시 | `20006 -> 443`, `20005 -> 80` (이전 URL 임시 유지) | HTTPS, HTTP 이동 | 내부 Webmail HTTP |

## 런타임 흐름

```text
Internet SMTP
  -> smtp-receiver
     -> mailbox-store (Maildir)
        -> imap-mailbox
        -> webmail-ui import

webmail-ui compose
  -> smtp-receiver
  -> sent mailbox metadata
```

`mailbox-store`는 SMTP, IMAP, Webmail이 공유한다. `smtp-queue-store`는 Postfix 큐, `webmail-data-store`는 Webmail 변환 메일을 보존한다. `mailbox-account-store`는 Dovecot 인증 사용자와 Postfix 수신 주소 map을 보존한다.

Webmail은 `mailbox-store`를 read-only로 읽어 원본 Maildir을 자체 저장 형식으로 가져온다. 변환된 메시지는 `mail/{inbox,sent,bounced}/<message-id>` 아래의 `meta.json`, `body.txt`, `body.html`, `attachments/`로 저장한다.

## Webmail Request Flow

```text
browser
  -> production HTTPS proxy (개발은 loopback HTTP)
  -> server.mjs auth/send/download handlers
  -> Next.js App Router pages
     -> auth-core signed session
     -> mailAccess ownership rule
     -> mailStore filesystem/import rule
```

로그인 사용자는 HMAC 서명 cookie로 식별한다. 로그인 비밀번호는 `mailbox-account-store`의 Dovecot passwd-file에 있는 hash로 확인한다. 신규 계정은 8~128자 전체를 검증하는 Argon2id를 사용하고 기존 salted bcrypt(BLF-CRYPT) 계정도 변경 없이 검증한다. 회원가입은 운영 가입 코드를 요구하며 Dovecot 사용자, 허용된 각 domain의 Postfix 수신 주소, 사용자별 Maildir 배달 경로를 함께 등록한다. 받은메일과 반송메일은 수신자 local-part, 보낸메일은 발신자 local-part가 현재 사용자와 일치해야 조회·상세·첨부 접근이 허용된다.

```text
webmail signup
  -> mailbox-account-store/dovecot-users
  -> mailbox-account-store/virtual-mailbox-accounts
     -> UID 5010 watcher: validate + postmap + atomic LMDB replacement
  -> mailbox-store/<user>/Maildir
```

메일 발송은 로그인 사용자 ID와 `MAIL_DEFAULT_DOMAIN`으로 발신 주소를 고정하고 내부 `SMTP_HOST:587` (호환 `2587`은 동일 정책)에 검증된 STARTTLS와 전용 SASL 계정으로 제출한다. 클라이언트가 보낸 임의 발신자 문자열은 실제 발신자 권한으로 사용하지 않는다.

## Configuration Boundary

- 공통 host/domain/port/image/volume 값은 `.env`에서 Compose로 전달한다.
- SMTP·IMAP·프록시는 `MAIL_TLS_DIR`의 서버 인증서와 개인키를 read-only로 읽는다. CA 개인키는 공유하지 않는다. SMTP는 STARTTLS를 제공하고, IMAP 로그인에는 TLS 1.2 이상의 연결이 필요하다.
- 운영 Webmail은 HTTPS 프록시를 통해 공개하며 HTTP는 `MAIL_WEB_HOSTNAME`과 `MAIL_WEB_HTTPS_PORT`의 주소로 이동한다. 개발 HTTP는 loopback에만 노출한다.
- `MAIL_NETWORK_SUBNET`은 Compose 네트워크 대역만 정하며 중계 권한을 부여하지 않는다. 공개 `25 → 25` (호환 리스너 `2525` 유지)는 로컬 domain 수신만 허용하고, 내부 `587` 및 호환 `2587`은 TLS와 허용된 전용 SASL 사용자만 허용한다.
- Dovecot은 `smtp-auth-store`의 Unix socket으로 SMTP AUTH를 제공한다. SMTP 서비스는 socket volume을 read-only로 mount한다. 일반 IMAP 사용자 인증만으로 제출 권한을 얻지 못한다.
- `MAIL_SMTP_CA_FILE`은 앱이 서버를 검증할 공개 CA bundle이며 서버 개인키를 앱에 공유하지 않는다. 외부 MTA 배달도 TLS와 인증서 검증 실패 시 큐에 보류한다.
- `WEBMAIL_SESSION_SECRET`과 `WEBMAIL_SIGNUP_TOKEN`은 운영에서 placeholder를 허용하지 않는다.
- 운영 Compose의 `WEBMAIL_COOKIE_SECURE`는 `true`로 고정한다. 개발 HTTP 실행은 `false`를 사용한다.
- SMTP 수신 가능 ID는 회원가입으로 `mailbox-account-store/virtual-mailbox-accounts`에 등록한다.

## 저장소 원칙

실행 모듈, Compose, 문서만 추적한다. 이미지 빌드나 릴리즈 패키지는 Dockerfile과 Compose에서 재생성하며 저장소 내부에 생성물을 보관하지 않는다. `sprint/` workflow 계약은 로컬 guard 입력으로만 사용하고 Git에는 추적하지 않는다.

운영 통합은 `compose.platform.yaml`의 `platform` 프로젝트가 담당한다. 다섯 실제 volume을 external로 사용하며 API 진단은 loopback20105, 일반 API는 HTTPS20006의 `/api/` 경로를 사용한다. 전환·검증·보안 패키지 판정은 [전환 기록](../guides/ubuntu-platform-transition.md)에 정리한다.

Maildir/drop MIME 첨부는 backpressure를 적용해 stream으로 저장하고 기존 CID 변환과 ledger를 보존한다. 메타데이터 I/O는 요청당32개, Maildir source는4개로 제한한다. Webmail V8 old/semi-space512/16MiB와 proxy2 worker/upstream keepalive8은 [성능 운영 기록](../guides/performance-2026-11-11.md)의 측정 workload에 맞춘 기본값이며 환경변수로 조정한다.
