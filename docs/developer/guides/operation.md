# MailBox 운영

## 상태 확인

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f mailbox-smtp-receiver
docker compose -f docker-compose.prod.yml logs -f mailbox-imap-mailbox
docker compose -f docker-compose.prod.yml logs -f mailbox-webmail-ui
docker compose -f docker-compose.prod.yml logs -f mailbox-webmail-proxy
```

## 로그 확인

운영 Compose는 SMTP 컨테이너의 `/var/log`를 호스트 로그 디렉터리에 마운트한다. 기본 경로는 `logs/smtp`이며 `.env`의 `MAIL_LOG_DIR`로 변경할 수 있다.

```bash
tail -f logs/smtp/postfix.log
```

IMAP, Webmail과 HTTPS 프록시는 표준 출력 로그를 사용한다. SMTP는 TLS 연결 정보도 Postfix 로그에 남긴다. 로그인·메일 조회·발송의 Webmail 감사 로그는 기존 JSON Lines 스키마를 유지한다. Compose 로그는 local logging driver로 보존하며, `MAIL_LOG_MAX_SIZE`, `MAIL_LOG_MAX_FILE` 값으로 회전 크기와 파일 개수를 조정한다.

```bash
docker compose -f docker-compose.prod.yml logs -f mailbox-imap-mailbox
docker compose -f docker-compose.prod.yml logs -f mailbox-webmail-ui
```

## 재시작

```bash
docker compose -f docker-compose.prod.yml restart
```

계정과 수신 주소는 `mailbox-account-store` named volume에 있으므로 컨테이너 restart, recreate, image rebuild 후에도 유지된다. `docker compose down -v` 또는 volume의 명시적 삭제는 계정을 제거하므로 백업 없이 실행하지 않는다.

## 코드와 이미지 교체

검증된 commit을 checkout한 뒤 운영 이미지를 다시 빌드하고 컨테이너를 재생성한다.

```bash
docker compose -f docker-compose.prod.yml up -d --build
curl -f https://<MAIL_WEB_HOSTNAME>:18443/login
```

## 롤백

이전 검증 commit을 checkout한 뒤 같은 `up -d --build`, HTTPS 확인 절차를 실행한다. named volume은 checkout과 image rebuild로 삭제되지 않는다. 로컬 CA를 사용하면 HTTP 검사에 `--cacert <공개-CA-인증서>`를 추가한다.

## TLS 점검과 인증서 교체

```bash
openssl s_client -starttls imap -connect <호스트>:143 -servername <호스트> -verify_hostname <호스트> -verify_return_error -CAfile <공개-CA-인증서>
openssl s_client -starttls smtp -connect <호스트>:25 -servername <호스트> -verify_hostname <호스트> -verify_return_error -CAfile <공개-CA-인증서>
```

위 명령은 domain 접속 기준이다. IP로 검증할 때는 `-verify_hostname` 대신 `-verify_ip`를 사용한다. 공인 CA 인증서는 시스템 CA 저장소를 사용할 수 있다. `MAIL_TLS_DIR`의 서버 인증서·키를 새 쌍으로 교체한 뒤 다음을 실행한다. Caddy 관리 API는 비활성화돼 있으므로 프록시는 restart로 인증서를 다시 읽는다.

```bash
docker compose -f docker-compose.prod.yml exec mailbox-smtp-receiver postfix reload
docker compose -f docker-compose.prod.yml exec mailbox-imap-mailbox doveadm reload
docker compose -f docker-compose.prod.yml restart mailbox-webmail-proxy
```

`MYNETWORKS`는 실제 `MAIL_NETWORK_SUBNET`과 일치해야 한다. 외부 연결에서 비인증 타 domain 수신자가 `Relay access denied`로 거절되고, 내부 Webmail에서는 발송을 접수할 수 있는지 함께 확인한다. 테스트 중 실제 메일을 보낼 필요는 없다. 프록시의 HTTP 포트는 `MAIL_WEB_HOSTNAME`과 `MAIL_WEB_HTTPS_PORT`로 이동하므로 DNS 변경 시 `.env`도 일치시킨 뒤 컨테이너를 재생성한다.

## 이미지 빌드 및 Push

각 모듈은 자신의 Dockerfile로 독립 빌드한다.

```bash
docker build -t <registry>/mailbox-webmail-ui:<release_tag> webmail-ui
docker push <registry>/mailbox-webmail-ui:<release_tag>
```

## 계정과 수신 주소 관리

사용자가 Webmail에서 가입하면 `mailbox-account-store`의 Dovecot 사용자 파일과 Postfix 수신 주소 map이 함께 갱신된다. SMTP 컨테이너는 map 변경을 감지해 형식을 검증하고 `postmap`과 reload를 수행한다. 운영자는 정상 가입 후 다음을 확인한다.

```bash
docker compose -f docker-compose.prod.yml logs mailbox-webmail-ui | grep 'auth.signup.success'
docker compose -f docker-compose.prod.yml logs mailbox-smtp-receiver
```

계정 파일을 호스트나 컨테이너에서 직접 수정하지 않는다. 복구가 필요하면 먼저 `mailbox-account-store` volume을 백업하고 두 계정 파일의 일관성을 함께 확인한다.
