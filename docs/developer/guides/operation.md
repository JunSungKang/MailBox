# MailBox 운영

## 상태 확인

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f mailbox-smtp-receiver
docker compose -f docker-compose.prod.yml logs -f mailbox-imap-mailbox
docker compose -f docker-compose.prod.yml logs -f mailbox-webmail-ui
```

## 로그 확인

운영 Compose는 SMTP 컨테이너의 `/var/log`를 호스트 로그 디렉터리에 마운트한다. 기본 경로는 `logs/smtp`이며 `.env`의 `MAIL_LOG_DIR`로 변경할 수 있다.

```bash
tail -f logs/smtp/postfix.log
```

IMAP과 Webmail은 표준 출력 로그를 사용한다. Compose 로그는 local logging driver로 보존하며, `MAIL_LOG_MAX_SIZE`, `MAIL_LOG_MAX_FILE` 값으로 회전 크기와 파일 개수를 조정한다.

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
curl -f http://localhost:${MAIL_WEB_PORT:-18080}
```

## 롤백

이전 검증 commit을 checkout한 뒤 같은 `up -d --build`, HTTP 확인 절차를 실행한다. named volume은 checkout과 image rebuild로 삭제되지 않는다.

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
