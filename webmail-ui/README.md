# MailBox Webmail UI

Next.js 기반 `mailbox-webmail-ui` 모듈입니다. 전체 메일 서버는 루트의 `docker-compose.yml`로 `mailbox-smtp-receiver`, `mailbox-imap-mailbox`, `mailbox-webmail-ui`를 함께 실행합니다.

## 로컬 개발

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Docker 실행

단독 실행보다 루트 Compose 실행을 권장합니다.

```bash
docker compose up -d --build
```

Compose 환경에서 `mailbox-webmail-ui`는 다음 값을 사용합니다.

- `SMTP_URL=smtp://mailbox-smtp-receiver:25/?ignoreTLS=true`
- `MAILDIR_IMPORT_DIR=/mailboxes/mailbox/Maildir`
- `MAIL_DATA_DIR=/app/data`
- `MAIL_ACCOUNT_DIR=/accounts`
- `MAIL_DOMAINS=ds-mail.p-e.kr post.ds-mail.p-e.kr`

## Mail Storage

웹 UI가 변환해 저장한 메일은 `MAIL_DATA_DIR` 아래에 저장됩니다.

```text
mail/inbox/<message-id>/
mail/sent/<message-id>/
mail/bounced/<message-id>/
```

각 메시지 디렉터리는 `meta.json`, `body.txt`, `body.html`, 첨부파일용 `attachments/`를 포함합니다.

`mailbox-smtp-receiver`가 수신한 원본 메일은 Compose의 `mailbox-store` volume에 Maildir 형식으로 저장되고, `mailbox-webmail-ui`는 `MAILDIR_IMPORT_DIR`에서 이 메일을 읽어 웹 UI 저장소로 가져옵니다.

## Sending Mail

발송 화면은 모든 발신 메일을 `sent`에 저장합니다. 실제 발송은 `SMTP_URL`로 지정된 `mailbox-smtp-receiver` 컨테이너에 접수합니다.

수신자에 도메인을 입력하지 않으면 `MAIL_DEFAULT_DOMAIN` 값이 붙습니다.

## Accounts

회원가입은 `mailbox-account-store` named volume의 Dovecot passwd-file과 Postfix 수신 주소 map을 함께 갱신합니다. Webmail 전용 `users.json`은 사용하지 않습니다. 비밀번호는 salted bcrypt(BLF-CRYPT) hash로만 저장되며 가입한 사용자는 Webmail과 IMAP에서 같은 비밀번호를 사용합니다.
