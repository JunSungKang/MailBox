# MailBox Architecture Contract

문서 최신화 기준일: 2026-11-04

## Repository Ownership

사용자 표시는 `MailBox`, 기계 식별자는 `mailbox`, 로컬 checkout 디렉터리는 `mail-box`를 사용한다. `MailBox` TypeScript 타입과 `mailbox-store`처럼 메일함 자체를 뜻하는 기존 도메인 용어는 의미를 유지한다.

```text
docker-compose*.yml
  -> smtp-receiver
  -> imap-mailbox
  -> webmail-ui

docs/ai-agent   -> 작업 규칙과 불변 계약
docs/developer  -> 사람 개발자용 설명과 운영 지식
```

| 경로 | 소유 책임 | 두지 않는 책임 |
| --- | --- | --- |
| `smtp-receiver` | Postfix 설정, 수신 주소, Maildir 배달 | Webmail 사용자·UI, IMAP 인증 |
| `imap-mailbox` | Dovecot 설정, Maildir IMAP 제공 | SMTP routing, Webmail 저장 형식 |
| `webmail-ui` | 로그인, 사용자별 메일 조회, 발송, Web UI 저장, HTTPS 프록시 설정 | Postfix·Dovecot 시스템 설정 |
| 루트 Compose | 컨테이너 연결, port, volume, 환경변수 | 모듈 내부 business logic |
| `docs/ai-agent` | 변경 절차, 검증, 금지 조건 | 사람 중심 온보딩 서술 |
| `docs/developer` | 구조, 실행, 운영, 사용자 설명 | agent 전용 workflow 계약 |

## Allowed Dependency Direction

```text
Docker Compose -> module public runtime surface
webmail-ui/src/app -> webmail-ui/src/lib
webmail-ui/server.mjs -> auth-core.mjs + filesystem + SMTP transport
smtp-receiver -> mailbox-store <- imap-mailbox
webmail-ui -> mailbox-store (read-only import)
webmail-ui -> smtp-receiver (SMTP submission)
webmail-ui -> mailbox-account-store (account provisioning)
smtp-receiver + imap-mailbox -> mailbox-account-store (runtime account read)
```

SMTP나 IMAP 모듈이 Webmail 내부 파일을 import하거나, Webmail이 Postfix/Dovecot 설정 파일을 수정하는 방향은 금지한다.

## Security Invariants

- 신규 비밀번호는 8~128자로 받으며 Dovecot 호환 salted Argon2id hash로 저장해 긴 비밀번호 전체를 검증한다. 기존 BLF-CRYPT 계정은 hash를 바꾸지 않고 계속 검증한다. 평문 비밀번호는 저장·기록하지 않는다.
- SMTP `25`는 TLS 1.2 이상의 STARTTLS를 제공하고, IMAP `143`은 STARTTLS 후 로그인을 요구한다.
- `MAIL_TLS_DIR`의 서버 인증서·키만 각 서비스에 read-only로 mount한다. CA 개인키는 해당 디렉터리 밖에 보관하며 인증서·키·`.env`는 추적하지 않는다.
- 운영 HTTPS 프록시만 Webmail을 외부에 노출하며 로그인 cookie는 `Secure`를 사용한다. 개발 HTTP는 loopback 전용이다.
- 공개 SMTP는 사설망·loopback을 포함한 네트워크 위치로 외부 중계를 허용하지 않는다. `mynetworks`는 loopback으로 고정한다.
- 앱은 내부 `2587`에 전용 SASL 계정과 필수 STARTTLS로 제출하며 CA·호스트명 검증을 생략하지 않는다. 실패 시 sendmail/평문 fallback은 금지한다.
- MTA 외부 배달은 `smtp_tls_security_level=verify`로 TLS와 MX 호스트 인증서 검증을 요구한다. 지원하지 않는 목적지는 큐에 보류한다.
- Dovecot SASL 소켓은 `smtp-auth-store`에서 root와 SMTP 전용 GID 1500만 접근한다. 계정 맵 감시기는 UID 5010, capability 0으로 실행한다.
- Postfix master/virtual의 필요한 root 권한과 일반 작업자의 권한을 구분한다. 잔여 root 권한을 위험 수용 승인으로 간주하지 않는다.
- `mailbox_user`는 HMAC 검증을 통과한 cookie만 신뢰한다.
- 가입은 운영 가입 코드를 요구하며 Dovecot 사용자와 허용 domain의 Postfix 수신 주소를 함께 생성한다.
- inbox, sent, bounced, detail, attachment, send는 현재 사용자 소유권을 검사한다.
- `mailbox-store`는 Webmail에 read-only로 mount한다.
- `mailbox-account-store`는 계정 원본이며 Webmail만 제한된 두 계정 파일을 갱신한다.

## Data Invariants

- SMTP와 IMAP은 같은 `mailbox-store`의 Maildir을 공유한다.
- Postfix queue는 `smtp-queue-store`, Webmail 변환 데이터와 사용자는 `webmail-data-store`에 둔다.
- Dovecot 사용자와 Postfix 수신 주소 map은 `mailbox-account-store`에 보존한다.
- `docker compose down`은 volume을 보존하고 `down -v`만 volume을 제거한다.
- 생성된 release, packaging script, tracked sprint contract를 저장소에 추가하지 않는다.
