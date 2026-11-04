# MailBox 설치

## 준비

- Linux 서버에 Docker Engine과 Docker Compose plugin을 설치한다.
- 접속 호스트의 DNS `A` 레코드를 서버 공인 IPv4로 지정하고, 수신 domain의 `MX`를 해당 메일 호스트명으로 지정한다. `MX`의 대상에는 IP 주소 대신 호스트명을 쓴다.
- TCP `25`(SMTP 수신), `143`(IMAP STARTTLS), `18443`(Webmail HTTPS), `18080`(HTTPS 이동)을 방화벽에서 허용한다.
- 운영 발신까지 사용할 경우 `SPF`, `DKIM`, `DMARC`, `PTR/rDNS`를 별도로 준비한다.

저장소 루트에서 환경 파일을 준비한다.

```bash
cp .env.example .env
```

운영 전 `WEBMAIL_SESSION_SECRET`을 32자 이상의 무작위 값으로, `WEBMAIL_SIGNUP_TOKEN`을 운영자만 아는 16자 이상의 가입 코드로 교체한다. placeholder 값으로는 운영 Webmail이 시작되지 않는다. 세션 secret이 바뀌면 기존 로그인 세션은 만료된다. 운영 Compose는 HTTPS 프록시와 `Secure` 로그인 cookie를 사용한다. 개발 HTTP 접속은 `WEBMAIL_COOKIE_SECURE=false`를 사용한다.

`MAIL_DOMAINS`에는 회원가입 시 자동으로 생성할 수신 domain을 공백으로 구분해 입력한다. 첫 번째 domain을 `MAIL_DEFAULT_DOMAIN`과 동일하게 두는 것을 권장한다. 계정은 `MAILBOX_ACCOUNT_VOLUME` named volume에 보존된다.

## TLS 인증서와 네트워크

운영자가 발급한 인증서 체인과 암호가 없는 서버 개인키를 `MAIL_TLS_DIR`에 각각 `fullchain.pem`, `privkey.pem`으로 준비한다. 기본 디렉터리는 저장소 루트의 `tls/`다. SMTP, IMAP, HTTPS 프록시는 이 디렉터리를 read-only로 공유한다. 디렉터리가 없으면 Compose 기동이 실패하며, IMAP은 유효한 인증서와 키가 없으면 시작하지 못한다.

인증서의 SAN에는 실제 접속할 domain 또는 IP가 포함돼야 한다. `MAIL_WEB_HOSTNAME`에는 해당 주소를, `MAIL_WEB_HTTPS_PORT`에는 HTTPS 공개 포트(기본 `18443`)를 지정한다. 개발에서도 인증서 두 파일이 필요하다. 로컬 CA를 사용하면 접속 기기에 공개 CA 인증서의 신뢰를 등록한다. CA 개인키는 서버 인증서 디렉터리 밖에 보관한다.

```bash
chmod 600 .env
chmod 600 tls/privkey.pem
openssl x509 -in tls/fullchain.pem -noout -subject -issuer -dates
```

위 명령의 `tls/`는 `MAIL_TLS_DIR` 값을 지정한 경우 해당 경로로 바꾼다. 인증서·개인키·`.env`·계정 파일은 Git에 넣지 않는다. 공인 CA 발급과 갱신은 운영자가 준비하며, 이 Compose는 자동 발급을 수행하지 않는다.

기본 컨테이너 네트워크는 `172.25.0.0/16`이다. 기존 네트워크와 충돌하면 `MAIL_NETWORK_SUBNET`과 `MYNETWORKS`의 컨테이너 대역을 함께 변경한다. `MYNETWORKS`는 loopback과 메일 컨테이너 대역만 허용한다. Docker Desktop이 외부 접속을 사설 IP로 전달할 수 있으므로 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` 전체를 신뢰하지 않는다.

## 실행

개발 또는 소스 검증 환경에서는 세 이미지를 직접 빌드해 실행한다.

```bash
docker compose up -d --build
```

운영 환경에서는 `.env`의 보안·domain·port·인증서 값을 확인하고 운영 Compose로 세 모듈과 HTTPS 프록시를 실행한다.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 점검

`docker compose -f docker-compose.prod.yml ps`에서 네 컨테이너의 실행 상태를 확인한다. Webmail은 기본값 기준 `https://<MAIL_WEB_HOSTNAME>:18443/login`에서 확인한다. 로컬 CA를 사용하면 `curl --cacert <공개-CA-인증서> https://<호스트>:18443/login`으로 서버 인증서를 검증한다.

개발 Compose의 Webmail HTTP 포트는 loopback에만 노출된다. 외부 접속에는 운영 Compose를 사용한다. SMTP `25`는 서버 간 수신과 내부 Webmail 발송을 위한 포트이며, 외부 클라이언트용 SMTP AUTH/587 submission은 제공하지 않는다.

## 기존 설치 전환

기존 `webmail-data-store/users.json`의 scrypt hash는 Dovecot passwd-file hash로 안전하게 변환할 수 없다. 기존 설치를 전환할 때는 데이터를 백업하고 기존 사용자가 운영 가입 코드로 다시 가입하도록 안내한다. 기존 `users.json`은 새 버전에서 읽거나 갱신하지 않으며, 확인 전 임의로 삭제하지 않는다.
