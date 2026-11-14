# MailBox 장애 대응

## 이미지 pull 실패

- registry 주소와 이미지 태그를 `.env`에서 확인한다.
- private registry라면 `docker login` 상태를 확인한다.
- 폐쇄망이면 이미지 tar 파일을 `docker load`로 먼저 적재한다.

## 컨테이너 기동 실패

```bash
docker compose -f compose.platform.yaml ps
docker compose -f compose.platform.yaml logs mailbox-smtp-receiver
docker compose -f compose.platform.yaml logs mailbox-imap-mailbox
docker compose -f compose.platform.yaml logs mailbox-webmail-ui
docker compose -f compose.platform.yaml logs mailbox-webmail-proxy
```

포트 충돌이 있으면 `SMTP_PORT`, `IMAP_PORT`, `MAIL_WEB_PORT`, `MAIL_WEB_HTTPS_PORT` 값을 확인한다. `MAIL_TLS_DIR`가 존재하고 그 안의 `fullchain.pem`, `privkey.pem`을 컨테이너 root가 읽을 수 있어야 한다.

## STARTTLS 또는 인증서 오류

- IMAP은 `143`의 STARTTLS를 사용한다. TLS 연결 전에는 로그인이 거절된다.
- 인증서 SAN에 메일 클라이언트에 입력한 실제 서버 주소가 포함됐는지 확인한다. domain과 IP는 별도 항목이다.
- 로컬 CA라면 접속 기기에 공개 CA 인증서의 신뢰를 등록한다. 개인키를 기기로 배포하지 않는다.
- 인증서 만료, 체인 누락, 개인키 불일치 여부를 확인한다. 교체 후 재적용은 [운영 안내](./operation.md)의 TLS 절차를 따른다.
- SMTP 로그의 TLS 오류와 IMAP의 `Failed to initialize SSL server context`를 확인한다.

## 메일 수신 실패

- DNS `MX` 레코드가 서버를 가리키는지 확인한다.
- 클라우드 방화벽과 OS 방화벽에서 TCP 25번 인바운드가 열려 있는지 확인한다.
- `mailbox-smtp-receiver` 로그에서 수신 주소 매핑 실패 여부를 확인한다.
- 가입 직후라면 SMTP 로그에서 account map 검증 또는 `postmap` 실패를 확인한다.

## 회원가입 또는 로그인 실패

- Webmail 로그에서 `auth.signup.provision_failure`, `auth.signup.exists`, `auth.login.backend_failure` 이벤트를 확인한다.
- `mailbox-account-store` volume이 세 컨테이너에 연결됐는지 Compose config로 확인한다.
- Dovecot 사용자 파일과 Postfix 수신 주소 map의 소유권이 UID/GID `5000`에서 읽고 쓸 수 있는지 확인한다.
- 기존 `users.json` 계정은 자동 변환되지 않으므로 같은 ID와 기존 비밀번호로 다시 가입한다. 가입 코드는 필요하지 않다. 기존 recipient 주소도 예약되므로 소유권 자료가 없는 alias/orphan ID는 운영자가 원래 소유자를 확인해 복구해야 한다.
- IMAP 인증 프로세스의 `extra_groups = vmail`이 적용돼 있는지 확인한다. 계정 디렉터리 권한을 모든 사용자에게 열어 해결하지 않는다.

## 웹메일 접속 실패

- `mailbox-webmail-ui` 컨테이너 상태와 로그를 확인한다.
- `MAIL_WEB_HTTPS_PORT`가 방화벽에서 허용되어 있는지 확인한다. 운영 기본 HTTPS 포트는 `20006`이다.
- DNS `A` 레코드가 실제 서버 IP를 가리키고, `MAIL_WEB_HOSTNAME`이 접속할 주소와 일치하는지 확인한다. DNS의 A 레코드는 웹 접속 포트 번호를 지정하지 않는다.
- `https://<호스트>:20006/login`에서 응답을 확인한다. 로컬 CA는 `curl --cacert <공개-CA-인증서>`로 검증한다.
- 개발 Compose의 HTTP 포트는 loopback 전용이다. 외부 접속에는 운영 Compose를 사용한다.

## SMTP 보안 제출 실패

`SMTP_URL`, `ignoreTLS`, sendmail fallback은 지원하지 않는다. `SMTP_AUTH_USER`/`SMTP_AUTH_PASSWORD`가 전용 계정과 일치하는지, `MAIL_SMTP_CA_FILE`과 `MAIL_HOSTNAME`이 인증서 체인/SAN에 맞는지 확인한다. `node smtp-bootstrap.mjs`는 기존 계정을 덮어쓰지 않고 실제 STARTTLS/SASL 인증을 검사한다. 앱은 원시 SMTP 응답·비밀번호를 오류 로그에 저장하지 않는다. 외부 목적지가 TLS/호스트 검증을 통과하지 못하면 Postfix 큐에 보류되며 평문 재시도는 없다.

통합 Ubuntu 이미지의 빌드·공유 잠금·실제 볼륨·호환 endpoint·복구 절차는 [Ubuntu platform 전환](ubuntu-platform-transition.md)을 따른다. 이전 `docker-compose*.yml`은 이전 commit과 이미지로 복구할 때의 구성이다.
