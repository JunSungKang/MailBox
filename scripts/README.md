# Scripts

이 디렉터리는 풀 컨테이너 메일 서버 운영 보조 스크립트를 담고 있습니다.

## 구성 요약

| 파일 | 실행 위치 | 권한 | 설명 |
| --- | --- | --- | --- |
| `mail-user-add.sh` | Linux shell | 일반 사용자 가능 | Compose 기반 `mail-smtp-receiver` 수신 계정 map에 주소를 추가, 삭제, 조회합니다. |

## 수신 계정 관리

실제 수신 가능한 주소 목록은 `mail-smtp-receiver` 모듈이 사용하는 Postfix hash map 원본 파일로 관리합니다.

- 원본 파일: `docker/postfix/virtual-mailbox-accounts`
- 컨테이너 내부 컴파일 경로: `/etc/postfix/maps/virtual-mailbox-accounts`
- Postfix 설정: `virtual_mailbox_maps = hash:/etc/postfix/maps/virtual-mailbox-accounts`
- 배달 대상: `mailbox/Maildir/`

원본 파일 형식:

```text
jskang@ds-mail.p-e.kr mailbox/Maildir/
bestdom@ds-mail.p-e.kr mailbox/Maildir/
mailbox@ds-mail.p-e.kr mailbox/Maildir/
postmaster@ds-mail.p-e.kr mailbox/Maildir/
root@ds-mail.p-e.kr mailbox/Maildir/
```

`mail-user-add.sh`를 사용하면 계정 파일을 수정하고, `mail-smtp-receiver` 컨테이너가 실행 중인 경우 `postmap`, `postfix check`, `postfix reload`까지 수행합니다. 컨테이너가 실행 중이 아니면 다음 컨테이너 시작 시 entrypoint가 map을 다시 컴파일합니다.

```bash
scripts/mail-user-add.sh add alice
scripts/mail-user-add.sh add alice@ds-mail.p-e.kr
scripts/mail-user-add.sh remove alice
scripts/mail-user-add.sh list
```

기본 대상 서비스명은 `mail-smtp-receiver`입니다. 필요하면 `SMTP_RECEIVER_SERVICE`, `SMTP_RECEIVER_MAP`, `SMTP_RECEIVER_CONTAINER_MAP` 환경변수로 바꿀 수 있습니다.

로컬명만 입력하면 기본적으로 `ds-mail.p-e.kr`, `post.ds-mail.p-e.kr` 두 도메인 주소가 모두 추가 또는 삭제됩니다. 특정 도메인만 처리하려면 `DOMAINS`를 지정합니다.

```bash
DOMAINS="ds-mail.p-e.kr" scripts/mail-user-add.sh add alice
```

## 주의 사항

- `mailbox`는 실제 `mail-imap-mailbox` 로그인 계정이고, 수신 주소들은 모두 같은 `mailbox/Maildir/`로 배달됩니다.
- 기본 `mail-imap-mailbox` 계정은 `mailbox`, 비밀번호는 `@@`입니다.
- 주소를 외부에 공개하기 전에는 DNS의 MX, SPF, DKIM, DMARC, PTR/rDNS, 클라우드 포트 25 제한을 별도로 확인해야 합니다.
