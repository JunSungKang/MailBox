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

위 명령은 domain 접속 기준이다. IP로 검증할 때는 `-verify_hostname` 대신 `-verify_ip`를 사용한다. 공인 CA 인증서는 시스템 CA 저장소를 사용할 수 있다. `MAIL_TLS_DIR`의 서버 인증서·키를 새 쌍으로 교체한 뒤 다음을 실행한다. 프록시는 restart로 인증서를 다시 읽는다.

```bash
docker compose -f docker-compose.prod.yml exec mailbox-smtp-receiver postfix reload
docker compose -f docker-compose.prod.yml exec mailbox-imap-mailbox doveadm reload
docker compose -f docker-compose.prod.yml restart mailbox-webmail-proxy
```

공개 25에서는 외부와 같은 사설망의 비인증 주체 모두 타 domain 수신자가 거절돼야 한다. 내부 2587은 TLS 전 MAIL을 거절하고, TLS 후에도 비인증·오인증·일반 IMAP 계정을 거절하며 전용 `SMTP_AUTH_USER`만 제출을 허용해야 한다. RCPT 이후 RSET/QUIT로 점검하면 실제 메일을 보내지 않는다. `MYNETWORKS` 설정으로 권한을 우회할 수 없다. 프록시의 HTTP 포트는 `MAIL_WEB_HOSTNAME`과 `MAIL_WEB_HTTPS_PORT`로 이동하므로 DNS 변경 시 `.env`도 일치시킨 뒤 컨테이너를 재생성한다.

## 이미지 빌드 및 Push

각 모듈은 자신의 Dockerfile로 독립 빌드한다.

```bash
docker build -t <registry>/mailbox-webmail-ui:<release_tag> webmail-ui
docker push <registry>/mailbox-webmail-ui:<release_tag>
```

## 계정과 수신 주소 관리

사용자가 Webmail에서 가입하면 `mailbox-account-store`의 Dovecot 사용자 파일과 Postfix 수신 주소 map이 함께 갱신된다. SMTP의 UID 5010 감시기는 map 변경을 감지해 형식을 검증하고 `postmap`으로 만든 LMDB를 원자 교체한다. Postfix는 갱신된 index를 감지하므로 root reload 감시기가 필요 없다. 운영자는 정상 가입 후 다음을 확인한다.

```bash
docker compose -f docker-compose.prod.yml logs mailbox-webmail-ui | grep 'auth.signup.success'
docker compose -f docker-compose.prod.yml logs mailbox-smtp-receiver
```

계정 파일을 호스트나 컨테이너에서 직접 수정하지 않는다. 복구가 필요하면 먼저 `mailbox-account-store` volume을 백업하고 두 계정 파일의 일관성을 함께 확인한다.

이전 `webmail-data-store/users.json`을 삭제하지 않는다. 이 파일의 기존 ID는 예약되며, 사용자가 가입 코드와 기존 scrypt 비밀번호를 함께 증명해야 같은 ID의 Dovecot 계정을 만들 수 있다. 이미 전환된 Dovecot 계정은 변경하지 않는다. 기존 비밀번호가 UTF-8 72바이트를 넘거나 SASL PLAIN에서 금지된 NUL 문자를 포함하거나 이전 정보가 손상됐다면 자동 이전을 차단한다. 운영자는 원래 소유자를 확인한 뒤 별도 복구를 수행하며 ID 예약을 풀기 위해 이전 파일을 삭제해서는 안 된다.

계정 생성은 두 파일을 교체하기 전에 같은 volume에 mode `0600`의 `.provision.pending.json` 복구 기록을 남긴다. 프로세스가 중단되면 시작 시와 다음 가입 요청에서 동일한 잠금 아래 나머지 교체를 완료한다. 중단된 잠금은 30초 뒤 회수하므로 재시작 직후 `Account store is busy`가 나오면 30초 후 다시 시작한다. 복구 성공은 `auth.account.recovered`, 이전 버전의 부분 계정 수신 주소 보정은 `auth.account.reconciled` INFO 이벤트로 확인한다. 이전 Dovecot 파일의 비밀번호 hash와 기존 별칭은 보존한다.

복구 기록과 현재 파일이 일치하지 않으면 수동 변경을 덮어쓰지 않고 기동·가입을 차단한다. 이 경우 세 파일을 함께 백업하고 원인을 확인한다. 복구 기록에는 계정 hash가 포함되므로 로그나 이슈에 원문을 첨부하거나 임의로 삭제하지 않는다. 가입 도중 실패 응답을 받았더라도 복구가 끝난 계정은 가입 시 사용한 비밀번호로 로그인할 수 있다.

SMTP 계정 준비 도구(`npm run smtp:provision`)는 기존 전용 계정을 검증된 TLS/AUTH로 먼저 확인한다. 인증 실패일 때만 가입 후 다시 검증하며 TLS·네트워크 오류로 계정을 생성하지 않는다. 새 전용 계정 비밀번호는 32자 이상이면서 UTF-8 72바이트 이하여야 한다. 이미 등록된 서비스 비밀번호는 재가입 검증 없이 기존 SMTP 인증 경로로 확인한다.

## 보안 점검

[2026-11-04 보안 검증](security-hardening-2026-11-04.md)에 이미지별 검사 결과와 필요한 root 권한을 기록했다. `smtp_tls_security_level=verify` 때문에 TLS 미지원·인증서 오류가 있는 외부 목적지는 지연 배달된다. 평문으로 완화하지 말고 `status=deferred` 사유와 목적지 TLS를 확인한다. SMTP 전용 계정 교체는 가입 API로 새 사용자를 만든 뒤 `SMTP_AUTH_USER`·비밀번호를 함께 교체하고 서비스를 재생성한다.

## Dovecot 2.4 전환과 롤백

IMAP 이미지는 Alpine stable의 Dovecot 2.4를 사용한다. 2.3 설정을 그대로 복사하지 말고 저장소의 2.4 설정을 사용한다. `dovecot_storage_version=2.3.0`은 기존 index와 롤백 호환성을 위해 유지한다. image 재빌드 시 `doveconf -n`, 기존 bcrypt 계정의 STARTTLS 로그인, Maildir UIDVALIDITY·UID·읽음 상태, Postfix SASL을 격리 환경에서 함께 확인한다. 변경 이미지의 취약점 검사도 다시 수행한다.
