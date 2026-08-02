# 아키텍처

## 모듈 경계

- `smtp-receiver`: 인터넷 SMTP 요청을 받아 Postfix가 Maildir에 배달한다.
- `imap-mailbox`: 같은 Maildir volume을 Dovecot IMAP으로 제공한다.
- `webmail-ui`: Maildir을 읽어 자체 메일 저장소로 가져오고 SMTP 수신기에 발송을 요청한다.

각 모듈은 자신의 Dockerfile과 설정을 소유한다. 루트 Docker Compose만 모듈 사이의 네트워크, volume, 포트와 환경변수를 조립한다.

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

## 저장소 원칙

실행 모듈, Compose, 문서만 추적한다. 이미지 빌드나 릴리즈 패키지는 Dockerfile과 Compose에서 재생성하며 저장소 내부에 생성물을 보관하지 않는다.
