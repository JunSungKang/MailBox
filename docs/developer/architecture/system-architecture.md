# System Architecture

문서 최신화 기준일: 2026-08-02

## 모듈 경계

- `smtp-receiver`: 인터넷 SMTP 요청을 받아 Postfix가 Maildir에 배달한다.
- `imap-mailbox`: 같은 Maildir volume을 Dovecot IMAP으로 제공한다.
- `webmail-ui`: Maildir을 읽어 자체 메일 저장소로 가져오고 SMTP 수신기에 발송을 요청한다.

각 모듈은 자신의 Dockerfile과 설정을 소유한다. 루트 Docker Compose만 모듈 사이의 네트워크, volume, 포트와 환경변수를 조립한다.

| 모듈 | 공개 port | 입력 | 출력 |
| --- | --- | --- | --- |
| `smtp-receiver` | `25` | SMTP, 수신 주소 map | Maildir, Postfix queue/log |
| `imap-mailbox` | `143` | Maildir | IMAP mailbox |
| `webmail-ui` | `18080 -> 3000` | HTTP, Maildir read, SMTP transport | HTML, Webmail data, SMTP submission |

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

`mailbox-store`는 SMTP, IMAP, Webmail이 공유한다. `smtp-queue-store`는 Postfix 큐, `webmail-data-store`는 Webmail 사용자와 변환된 메일 데이터를 보존한다.

Webmail은 `mailbox-store`를 read-only로 읽어 원본 Maildir을 자체 저장 형식으로 가져온다. 변환된 메시지는 `mail/{inbox,sent,bounced}/<message-id>` 아래의 `meta.json`, `body.txt`, `body.html`, `attachments/`로 저장한다.

## Webmail Request Flow

```text
browser
  -> server.mjs auth/send/download handlers
  -> Next.js App Router pages
     -> auth-core signed session
     -> mailAccess ownership rule
     -> mailStore filesystem/import rule
```

로그인 사용자는 HMAC 서명 cookie로 식별한다. 회원가입은 SMTP 주소 map에 존재하는 사용자 ID, scrypt 비밀번호, 운영 가입 코드를 요구한다. 받은메일과 반송메일은 수신자 local-part, 보낸메일은 발신자 local-part가 현재 사용자와 일치해야 조회·상세·첨부 접근이 허용된다.

메일 발송은 로그인 사용자 ID와 `MAIL_DEFAULT_DOMAIN`으로 발신 주소를 고정하고 `SMTP_URL`의 Postfix에 제출한다. 클라이언트가 보낸 임의 발신자 문자열은 실제 발신자 권한으로 사용하지 않는다.

## Configuration Boundary

- 공통 host/domain/port/image/volume 값은 `.env`에서 Compose로 전달한다.
- `WEBMAIL_SESSION_SECRET`과 `WEBMAIL_SIGNUP_TOKEN`은 운영에서 placeholder를 허용하지 않는다.
- HTTPS reverse proxy 뒤에서는 `WEBMAIL_COOKIE_SECURE=true`를 사용한다.
- SMTP 수신 가능 ID는 `smtp-receiver/virtual-mailbox-accounts`에서 관리한다.

## 저장소 원칙

실행 모듈, Compose, 문서만 추적한다. 이미지 빌드나 릴리즈 패키지는 Dockerfile과 Compose에서 재생성하며 저장소 내부에 생성물을 보관하지 않는다. `sprint/` workflow 계약은 로컬 guard 입력으로만 사용하고 Git에는 추적하지 않는다.
