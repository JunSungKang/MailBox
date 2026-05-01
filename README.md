# Mail Server Packaging

`mail-smtp-receiver`, `mail-imap-mailbox`, `mail-webmail-ui` 3개 컨테이너로 구성된 메일 서버 패키징 프로젝트다. 개발자는 `source/apps`에서 이미지를 빌드하고, 운영자는 GitHub Container Registry(GHCR)에 배포된 패키지 이미지를 pull 받아 Docker Compose로 실행한다.

## 1. 전체 구조

```text
source/
├── apps/
│   ├── smtp-receiver/   # Postfix SMTP 수신 컨테이너
│   ├── imap-mailbox/    # Dovecot IMAP 컨테이너
│   └── webmail-ui/      # Next.js Webmail 컨테이너
├── deploy/
│   ├── local/           # 소스 빌드 기반 로컬 검증 compose
│   ├── single-node/     # 이미지 pull 기반 운영 compose
│   └── templates/       # env 예시
├── docs/                # 설치, 운영, 장애 대응, 사용자 문서
├── scripts/
│   ├── images/          # 이미지 build/push/images.lock 생성
│   ├── package/         # release 패키지 생성
│   ├── verify/          # preflight, healthcheck, 주소 관리
│   └── backup/          # 메일 데이터 백업/복구
└── release/             # 생성된 납품 패키지
```

런타임 흐름:

```text
Internet SMTP
  -> mail-smtp-receiver
     -> mailbox-store volume
        -> mail-imap-mailbox
        -> mail-webmail-ui
```

## 2. 현재 GHCR 이미지

현재 release 패키지는 다음 이미지를 사용한다.

```text
ghcr.io/junsungkang/mail-server-smtp-receiver:v1.0.0
ghcr.io/junsungkang/mail-server-imap-mailbox:v1.0.0
ghcr.io/junsungkang/mail-server-webmail-ui:v1.0.0
```

동일한 목록은 `source/release/mail-server-1.0.0/images.lock`에 기록되어 있다.

## 3. 운영 서버에서 Docker Pull 방식으로 실행

### 3.1 준비 조건

- Linux 서버
- Docker Engine
- Docker Compose plugin
- GHCR package pull 권한이 있는 GitHub token
- SMTP 수신용 TCP `25`
- IMAP용 TCP `143`
- 웹메일용 TCP `18080`

메일을 외부에서 실제 수신하려면 DNS `MX`가 이 서버를 가리켜야 한다. 클라우드 서버는 TCP 25번 인바운드/아웃바운드 제한도 확인해야 한다.

### 3.2 저장소 받기

```bash
git clone https://github.com/JunSungKang/MailBox.git
cd MailBox
```

소스 전체가 필요 없고 납품 패키지만 전달받은 경우에는 `source/release/mail-server-1.0.0` 디렉터리만 서버에 올려도 된다.

### 3.3 GHCR 로그인

GitHub token을 환경변수로 넣고 GHCR에 로그인한다.

```bash
export GITHUB_USERNAME=JunSungKang
export GIT_TOKEN=<github_package_read_token>
printf '%s' "$GIT_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
```

token에는 최소한 GHCR package를 읽을 권한이 필요하다. private package라면 해당 package 접근 권한이 있는 계정의 token을 사용한다.

### 3.4 실행 환경 파일 작성

```bash
cd source/release/mail-server-1.0.0
cp mail-server.env.example mail-server.env
vi mail-server.env
```

운영 환경에서 주로 수정하는 값:

```dotenv
MAIL_HOSTNAME=mail.ds-mail.p-e.kr
MAIL_DOMAINS=ds-mail.p-e.kr post.ds-mail.p-e.kr
MAIL_FROM=mailbox@ds-mail.p-e.kr
MAIL_DEFAULT_DOMAIN=ds-mail.p-e.kr

SMTP_PORT=25
IMAP_PORT=143
MAIL_WEB_PORT=18080
MYNETWORKS=127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
```

이미지 값은 특별한 이유가 없으면 release 기본값을 유지한다.

### 3.5 이미지 Pull

```bash
mail-server/compose.sh pull
```

직접 pull 명령을 실행하려면 다음과 같이 받을 수 있다.

```bash
docker pull ghcr.io/junsungkang/mail-server-smtp-receiver:v1.0.0
docker pull ghcr.io/junsungkang/mail-server-imap-mailbox:v1.0.0
docker pull ghcr.io/junsungkang/mail-server-webmail-ui:v1.0.0
```

### 3.6 컨테이너 실행

```bash
mail-server/compose.sh up -d
```

실행되는 컨테이너:

- `mail-smtp-receiver`
- `mail-imap-mailbox`
- `mail-webmail-ui`

생성되는 Docker volume:

- `mailbox-store`
- `smtp-queue-store`
- `webmail-data-store`

### 3.7 설치 검증

```bash
checks/preflight.sh
checks/healthcheck.sh
```

수동 확인:

```bash
mail-server/compose.sh ps
mail-server/compose.sh logs -f mail-smtp-receiver
mail-server/compose.sh logs -f mail-imap-mailbox
mail-server/compose.sh logs -f mail-webmail-ui
```

웹메일 기본 주소:

```text
http://<server-ip>:18080
```

기본 IMAP 계정:

```text
user: mailbox
password: @@
```

### 3.8 중지와 삭제

컨테이너만 중지/삭제하고 메일 데이터 volume은 유지한다.

```bash
mail-server/compose.sh down
```

메일 데이터 volume까지 삭제한다.

```bash
mail-server/compose.sh down -v
```

## 4. 개발자가 코드에서 패키징하는 방법

### 4.1 로컬 빌드 검증

```bash
cd source/deploy/local
cp ../templates/local.env.example .env
docker compose --env-file .env up -d --build
```

검증 후 정리:

```bash
docker compose --env-file .env down
```

### 4.2 이미지 빌드 설정

로컬 전용 이미지 설정 파일을 만든다.

```bash
cd source
cp scripts/images/images.env.example scripts/images/images.env
vi scripts/images/images.env
```

예시:

```dotenv
REGISTRY=ghcr.io
IMAGE_NAMESPACE=junsungkang
VERSION=v1.0.0
IMAGE_NAME_PREFIX=mail-server-

GITHUB_USERNAME=JunSungKang
GIT_TOKEN=<github_package_write_token>
```

`scripts/images/images.env`는 `.gitignore`에 포함되어 있으므로 토큰이 커밋되지 않는다.

### 4.3 이미지 빌드

```bash
scripts/images/build-images.sh
```

생성 이미지:

```text
ghcr.io/junsungkang/mail-server-smtp-receiver:v1.0.0
ghcr.io/junsungkang/mail-server-imap-mailbox:v1.0.0
ghcr.io/junsungkang/mail-server-webmail-ui:v1.0.0
```

### 4.4 이미지 Push

```bash
scripts/images/push-images.sh
```

스크립트는 `GITHUB_USERNAME`과 `GIT_TOKEN` 또는 `GHCR_TOKEN`이 있으면 `docker login ghcr.io`를 수행한 뒤 3개 이미지를 push한다.

### 4.5 images.lock 생성

```bash
scripts/images/write-images-lock.sh
```

결과 파일:

```text
source/release/images.lock
```

registry digest를 조회할 수 있으면 digest 기준으로 기록하고, 그렇지 않으면 tag 기준으로 기록한다.

### 4.6 납품 패키지 생성

```bash
scripts/package/build-release.sh
```

기본 생성 위치:

```text
source/release/mail-server-1.0.0/
```

패키지 구성:

```text
mail-server-1.0.0/
├── README.md
├── VERSION
├── images.lock
├── mail-server/
│   ├── docker-compose.yml
│   ├── .env.example
│   └── compose.sh
├── docs/
├── checks/
└── mail-tools/
```

이 release 패키지는 소스 코드를 포함하지 않는다. 운영자는 이 패키지와 GHCR 이미지만으로 설치할 수 있다.

## 5. 운영 도구

메일 데이터 백업:

```bash
mail-tools/mail-backup.sh
```

메일 데이터 복구:

```bash
mail-server/compose.sh down
mail-tools/mail-restore.sh /srv/mail-server/backups/mail-server-YYYYMMDD-HHMMSS.tar.gz
mail-server/compose.sh up -d
checks/healthcheck.sh
```

수신 주소 관리:

```bash
mail-tools/mail-user-add.sh list
mail-tools/mail-user-add.sh add alice
mail-tools/mail-user-add.sh remove alice
```

운영 중 수신 주소를 바꾸는 방식은 배포 정책에 따라 다르다. 현재 기본 구조는 주소 파일을 SMTP 이미지에 포함하므로, 소스의 `source/apps/smtp-receiver/virtual-mailbox-accounts`를 수정한 뒤 새 이미지를 빌드하고 release를 갱신하는 방식을 기준으로 한다.
