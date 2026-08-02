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

## 수신 주소 관리

수신 주소는 `smtp-receiver/virtual-mailbox-accounts`에서 관리한다. 개발·운영 Compose는 이 파일을 SMTP와 Webmail에 읽기 전용으로 마운트한다. 변경 후 SMTP 컨테이너를 재시작하고 새 사용자의 가입 가능 여부를 확인한다.
