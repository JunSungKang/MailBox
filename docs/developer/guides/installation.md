# MailBox 설치

## 준비

- Linux 서버에 Docker Engine과 Docker Compose plugin을 설치한다.
- 접속 호스트의 DNS `A` 레코드를 서버 공인 IPv4로 지정하고, 수신 domain의 `MX`를 해당 메일 호스트명으로 지정한다. `MX`의 대상에는 IP 주소 대신 호스트명을 쓴다.
- TCP `25`(SMTP 수신), `143`(IMAP STARTTLS), `20006`(Webmail HTTPS), `20005`(HTTPS 이동)을 방화벽에서 허용한다.
- 운영 발신까지 사용할 경우 `SPF`, `DKIM`, `DMARC`, `PTR/rDNS`를 별도로 준비한다.

새 설치에서만 저장소 루트에 환경 파일을 준비한다. 기존 설치의 `.env`를 덮어쓰지 않는다.

```bash
cp .env.example .env
```

운영 전 `WEBMAIL_SESSION_SECRET`을 32자 이상의 무작위 값으로 교체한다. 세션 secret의 placeholder 값으로는 운영 Webmail이 시작되지 않는다. 회원가입은 아이디와 비밀번호로 공개 제공하며 `WEBMAIL_SIGNUP_TOKEN`은 설정하지 않아도 된다. 기존 환경 파일에 남아 있는 이 변수는 사용하지 않는다. 세션 secret이 바뀌면 기존 로그인 세션은 만료된다. 운영 Compose는 HTTPS 프록시와 `Secure` 로그인 cookie를 사용한다. 개발 HTTP 접속은 `WEBMAIL_COOKIE_SECURE=false`를 사용한다.

`MAIL_DOMAINS`에는 회원가입 시 자동으로 생성할 수신 domain을 공백으로 구분해 입력한다. 첫 번째 domain을 `MAIL_DEFAULT_DOMAIN`과 동일하게 두는 것을 권장한다. 계정은 `MAILBOX_ACCOUNT_VOLUME` named volume에 보존된다.

## TLS 인증서와 네트워크

운영자가 발급한 인증서 체인과 암호가 없는 서버 개인키를 `MAIL_TLS_DIR`에 각각 `fullchain.pem`, `privkey.pem`으로 준비한다. 기본 디렉터리는 저장소 루트의 `tls/`다. SMTP, IMAP, HTTPS 프록시는 이 디렉터리를 read-only로 공유한다. 디렉터리가 없으면 Compose 기동이 실패하며, IMAP은 유효한 인증서와 키가 없으면 시작하지 못한다.

인증서의 SAN에는 실제 접속할 domain 또는 IP가 포함돼야 한다. `MAIL_WEB_HOSTNAME`에는 해당 주소를, `MAIL_WEB_HTTPS_PORT`에는 HTTPS 공개 포트(기본 `20006`)를 지정한다. 개발에서도 인증서 두 파일이 필요하다. 로컬 CA를 사용하면 접속 기기에 공개 CA 인증서의 신뢰를 등록한다. CA 개인키는 서버 인증서 디렉터리 밖에 보관한다.

```bash
chmod 600 .env
chmod 600 tls/privkey.pem
openssl x509 -in tls/fullchain.pem -noout -subject -issuer -dates
```

위 명령의 `tls/`는 `MAIL_TLS_DIR` 값을 지정한 경우 해당 경로로 바꾼다. 인증서·개인키·`.env`·계정 파일은 Git에 넣지 않는다. 공인 CA 발급과 갱신은 운영자가 준비하며, 이 Compose는 자동 발급을 수행하지 않는다.

이전 `mailbox_default` 네트워크의 기본 대역은 `172.25.0.0/16`이다. 통합 운영은 기존 `platform_default`와 `mailbox_default`를 external network로 참조하며 재생성하지 않는다. `MAILBOX_COMPAT_SMTP_IP`는 실제 기존 SMTP IP를 확인해 지정한다. 네트워크 대역은 SMTP 중계 권한과 무관하며 기존 `MYNETWORKS` 환경변수는 더 이상 사용하지 않는다.

`SMTP_AUTH_USER`는 전용 서비스 사용자(기본 `mailbox-submit`), `SMTP_AUTH_PASSWORD`는 32자 이상의 무작위 비밀번호로 설정한다. 일반 사용자의 비밀번호를 재사용하지 않는다. `MAIL_SMTP_CA_FILE`에 SMTP 인증서를 발급한 공개 CA bundle 경로를 지정한다(공인 CA이면 배포 환경의 공개 CA bundle도 가능). 서버 인증서의 SAN에 `MAIL_HOSTNAME`이 있어야 한다. CA 개인키를 지정하지 않는다.

기동 후 전용 계정을 기존 가입 API로 등록하고 SMTP 인증을 검증한다. 명령은 기존 계정을 덮어쓰지 않으며 실패 시 운영 비밀값과 계정 설정을 확인한다.

```bash
docker compose -f compose.platform.yaml exec --user 5000:5000 mailbox-webmail-ui node smtp-bootstrap.mjs
```

내부 제출 포트 `587`(전환 기간 `2587`도 제공)을 호스트에 공개하지 않는다. 공개 SMTP `25`는 컨테이너 `25`(기존 `2525` 리스너도 유지)로 연결된다. `smtp-auth-store`는 Dovecot과 Postfix가 공유하는 인증 소켓이며 계정·메일 저장 volume과 별개다.

## 실행

Ubuntu 공통 Node24 기반과 네 이미지를 먼저 빌드한다. `NODE_IMAGE`를 생략하면 프로젝트 전용 Ubuntu 기반 이미지를 함께 빌드한다.

```bash
docker buildx bake
```

기존 운영의 교체는 [공유 잠금·백업·복구 절차](ubuntu-platform-transition.md)를 따른다. 이 Compose는 다섯 기존 volume과 두 네트워크를 요구하며, 새 설치에서는 운영자가 계정·디렉터리 소유권·네트워크를 먼저 준비해야 한다. 다음 명령은 설정만 검증한다.

```bash
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

## 점검

`docker compose -f compose.platform.yaml ps`에서 네 컨테이너의 실행 상태를 확인한다. Webmail은 기본값 기준 `https://<MAIL_WEB_HOSTNAME>:20006/login`에서 확인한다. 로컬 CA를 사용하면 `curl --cacert <공개-CA-인증서> https://<호스트>:20006/login`으로 서버 인증서를 검증한다.

개발 Compose의 Webmail HTTP 포트는 loopback에만 노출된다. 외부 접속에는 운영 Compose를 사용한다. SMTP `25`는 서버 간 수신용이다. Webmail은 내부 `587`로 TLS와 서비스 전용 SASL 인증을 사용한다. 외부 호스트에는 submission 포트를 공개하지 않는다.

## 기존 설치 전환

기존 `webmail-data-store/users.json`의 scrypt hash는 Dovecot passwd-file hash로 안전하게 변환할 수 없다. 기존 설치를 전환할 때는 데이터를 백업하고 기존 사용자가 같은 ID와 기존 비밀번호로 다시 가입하도록 안내한다. 새 버전은 `users.json`의 기존 ID를 예약하고 scrypt 비밀번호로 소유권을 검증한 뒤 Argon2id 계정을 생성한다. 원본 `users.json`은 변경하거나 임의로 삭제하지 않는다. 기존 Dovecot BLF-CRYPT 계정과 hash는 그대로 유지한다.

통합 Ubuntu 이미지의 빌드·공유 잠금·실제 볼륨·호환 endpoint·복구 절차는 [Ubuntu platform 전환](ubuntu-platform-transition.md)을 따른다. 이전 `docker-compose*.yml`은 이전 commit과 이미지로 복구할 때의 구성이다.
