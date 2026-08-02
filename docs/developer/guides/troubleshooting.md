# MailBox 장애 대응

## 이미지 pull 실패

- registry 주소와 이미지 태그를 `.env`에서 확인한다.
- private registry라면 `docker login` 상태를 확인한다.
- 폐쇄망이면 이미지 tar 파일을 `docker load`로 먼저 적재한다.

## 컨테이너 기동 실패

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs mailbox-smtp-receiver
docker compose -f docker-compose.prod.yml logs mailbox-imap-mailbox
docker compose -f docker-compose.prod.yml logs mailbox-webmail-ui
```

포트 충돌이 있으면 `SMTP_PORT`, `IMAP_PORT`, `MAIL_WEB_PORT` 값을 변경한다.

## 메일 수신 실패

- DNS `MX` 레코드가 서버를 가리키는지 확인한다.
- 클라우드 방화벽과 OS 방화벽에서 TCP 25번 인바운드가 열려 있는지 확인한다.
- `mailbox-smtp-receiver` 로그에서 수신 주소 매핑 실패 여부를 확인한다.
- 가입 직후라면 SMTP 로그에서 account map 검증 또는 `postmap` 실패를 확인한다.

## 회원가입 또는 로그인 실패

- Webmail 로그에서 `auth.signup.provision_failure`, `auth.signup.exists`, `auth.login.backend_failure` 이벤트를 확인한다.
- `mailbox-account-store` volume이 세 컨테이너에 연결됐는지 Compose config로 확인한다.
- Dovecot 사용자 파일과 Postfix 수신 주소 map의 소유권이 UID/GID `5000`에서 읽고 쓸 수 있는지 확인한다.
- 기존 `users.json` 계정은 자동 변환되지 않으므로 운영 가입 코드로 다시 가입한다.

## 웹메일 접속 실패

- `mailbox-webmail-ui` 컨테이너 상태와 로그를 확인한다.
- `MAIL_WEB_PORT`가 방화벽에서 허용되어 있는지 확인한다.
- `curl -f http://localhost:${MAIL_WEB_PORT:-18080}`으로 HTTP 응답을 확인한다.
