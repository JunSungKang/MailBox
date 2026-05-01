# Mail Server Source

`mail-smtp-receiver`, `mail-imap-mailbox`, `mail-webmail-ui`를 Docker Compose로 실행하는 풀 컨테이너 메일 서버입니다.

## 구성

```text
source/
├── apps/
│   ├── smtp-receiver/
│   ├── imap-mailbox/
│   └── webmail-ui/
├── deploy/
│   ├── local/
│   ├── single-node/
│   └── templates/
├── docs/
├── scripts/
└── release/
```

런타임 흐름:

```text
Internet SMTP
  -> mail-smtp-receiver module
     -> mailbox-store volume: /var/mail/vhosts/mailbox/Maildir
        -> mail-imap-mailbox module: IMAP mailbox account
        -> mail-webmail-ui module: web inbox import

mail-webmail-ui compose screen
  -> SMTP_URL=smtp://mail-smtp-receiver:25/?ignoreTLS=true
  -> mail-smtp-receiver module
```

## 빠른 시작

```bash
cd source/deploy/local
cp ../templates/local.env.example .env
docker compose --env-file .env up -d --build
```

서비스 URL과 포트:

- Web UI: `http://localhost:18080`
- SMTP: `localhost:25`
- IMAP: `localhost:143`

기본 메일 계정:

- IMAP 사용자: `mailbox`
- IMAP 비밀번호: `@@`
- 기본 발신 주소: `mailbox@ds-mail.p-e.kr`

## 수신 주소 관리

수신 가능한 주소는 `source/apps/smtp-receiver/virtual-mailbox-accounts`에서 관리합니다. 모든 주소는 통합 메일함 `mailbox/Maildir/`로 배달됩니다.

```bash
source/scripts/verify/mail-user-add.sh list
source/scripts/verify/mail-user-add.sh add alice
source/scripts/verify/mail-user-add.sh remove alice
```

로컬명만 입력하면 `ds-mail.p-e.kr`, `post.ds-mail.p-e.kr` 두 도메인 주소가 함께 처리됩니다.

## 운영 명령

```bash
docker compose ps
docker compose logs -f mail-smtp-receiver
docker compose logs -f mail-imap-mailbox
docker compose logs -f mail-webmail-ui
```

Postfix 설정 확인:

```bash
docker compose exec mail-smtp-receiver postconf -n
docker compose exec mail-smtp-receiver postmap -q jskang@ds-mail.p-e.kr /etc/postfix/maps/virtual-mailbox-accounts
```

컨테이너와 네트워크를 내리되 메일 데이터 volume은 유지:

```bash
docker compose down
```

메일 데이터까지 삭제:

```bash
docker compose down -v
```

## 실제 서버 배포 체크리스트

- DNS `MX`가 이 서버의 공인 IP 또는 호스트명을 가리키는지 확인합니다.
- 발신 평판을 위해 `SPF`, `DKIM`, `DMARC`, `PTR/rDNS`를 설정합니다.
- AWS/Azure 등 클라우드에서 TCP 25번 인바운드/아웃바운드 제한을 확인합니다.
- 운영 환경에서는 IMAP/SMTP 제출 포트에 TLS를 붙이는 구성을 추가하는 것이 좋습니다.
- `source/deploy/templates/local.env.example` 또는 릴리즈 패키지의 `mail-server.env`에서 서버 환경 값을 수정합니다.

## 릴리즈 패키지

CRM 프로젝트와 같은 이미지 pull 기반 납품 패키지는 다음 명령으로 생성합니다.

```bash
cd source
scripts/package/build-release.sh
```

생성 결과는 `source/release/mail-server-<version>/`에 위치합니다.
