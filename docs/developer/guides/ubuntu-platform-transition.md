# MailBox Ubuntu platform 전환

작업 기준: 2026-11-09 KST. 방법론은 Sprint Delivery다. 이 문서는 이미지·격리 검증과 운영 전환의 공개 인계 자료이며, 비밀값·메일 원문·계정 hash는 포함하지 않는다. 실제 배포 결과와 commit은 마지막 절 및 로컬 보호 증거를 함께 확인한다.

## 실행과 빌드

운영 daemon은 Docker Desktop `desktop-linux`, endpoint `unix:///Users/kkkk/.docker/run/docker.sock`, Linux ARM64, Engine 29.9.2다. 네 실행 컨테이너는 Ubuntu26.04다. SMTP와 Webmail은 같은 프로젝트 전용 Ubuntu Node24 base의 Node24.22.2를 사용한다. 공통 계약/이미지가 없어도 다른 세션을 기다리지 않는다. 공유 태그는 덮어쓰지 않는다.

```sh
docker buildx bake
# 명시적인 검증된 Ubuntu26.04/Node24 공통 이미지가 있으면:
NODE_IMAGE=<검증된-image-reference> docker buildx bake
# 이미 있는 운영 데이터로 실행할 때:
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

`docker-bake.hcl`의 node24 target은 공식 Node24.22.2 glibc 바이너리를 digest로 고정해 Ubuntu26.04에 옮기고 필요한 runtime library를 설치한다. `NODE_IMAGE`는 두 소비자의 Docker build ARG이며, 없으면 이 프로젝트의 node24 target을 사용한다. `TAG`는 프로젝트 이미지 태그를 지정한다. 기본 태그는 `ubuntu26.04`, 이번 검증 후보는 `ubuntu26.04-20261109-r3`다. 실제 운영 교체는 아래 잠금·백업 절차로 진행한다. `up`만 실행해 기존 컨테이너를 임의 교체하지 않는다.

운영 Python component/tool은 이 저장소에 없다. 이번 운영 조정은 Node24와 macOS 기본 Perl의 `flock(2)`를 사용하며 Python 버전 의존성을 추가하지 않는다. Java probe는 DamGoX2와 동일한 실제 runtime 이미지에서 잠깐 실행하는 검증 도구이며 MailBox runtime이 아니다. 현재 consumer가 JRE만 포함하므로 별도 JDK에서 Java17 호환 class로 컴파일하고 현재 consumer JRE에서 실행한다.

## 구성과 포트

Compose 프로젝트는 **platform**, 네 서비스/컨테이너 이름은 `mailbox-smtp-receiver`, `mailbox-imap-mailbox`, `mailbox-webmail-ui`, `mailbox-webmail-proxy`다. 공유 `platform_default`는 external network로 참조하므로 이 Compose가 재생성하거나 삭제하지 않는다. 새 설치에서만 통합 운영자가 `docker network create platform_default`로 준비한다. `mailbox_default`도 기존 client 연결을 위해 external로 참조한다. 다른 platform 서비스에 대한 stop/down/remove-orphans는 사용하지 않는다.

| 용도 | 새 endpoint | 전환 중 유지하는 경로 |
| --- | --- | --- |
| SMTP 수신 | 내부 `mailbox-smtp-receiver:25`, 호스트25:25 | 내부2525 동일 수신 정책 |
| 앱 제출 | 내부 `mailbox-smtp-receiver:587` | 내부2587 동일 STARTTLS/SASL/권한 정책 |
| IMAP | 내부/호스트143 STARTTLS | 동일 |
| Web HTTP | 호스트20005:80 | 이전18080:80, 새HTTPS20006으로308이동 |
| Web HTTPS | 호스트20006:443 | 이전18443:443 동일 인증서/앱 |
| API | 외부는 HTTPS20006의 `/api/` | loopback20105:3000은 로컬 진단용 |

웹20005~20009와 API20105~20109는 예약 범위다.20007~20009,20106~20109는 이번에 공개하지 않는다. API 진단20105는127.0.0.1에만 bind하므로 공용 평문 인증 경로가 아니다. SMTP587/2587은 호스트에 공개하지 않는다.

공통 세션이 여러 Compose 파일을 합칠 때 build context·TLS·CA·로그 경로는 이 checkout을 기준으로 절대 경로로 정규화해야 한다. standalone은 이 checkout에서 `-f compose.platform.yaml`로 실행한다. 기존 `.env`를 예제로 덮어쓰지 않는다.

## 실제 DamGoX2 영향

읽기 전용 조사에서 실행 중인 `platform-damgox2-worker-1`이 `mailbox_default`에 연결돼 SMTP를 사용한다. 최초 조사 때의 `damgox2-worker-1`은 다른 세션의 전환으로 이미 정지돼 있어, 실제 교체 gate에서 현재 running consumer를 다시 찾았다. web 역할은 backend에만 연결돼 있다. worker는 `mailbox-smtp-receiver:2587`, STARTTLS 필수, hostname 확인, 공개 CA와 자격 파일을 사용한다. 실제 Java transport의 `starttls.required=true`, `ssl.checkserveridentity=true`, TLS1.2/1.3 및 별도 trust store 설정을 확인했다.

기존 worker를 수정/재시작하지 않는다. 새 SMTP는 `platform_default`와 기존 `mailbox_default`에 함께 붙고 기존 SMTP IP를 인계받는다. 기존2587은 계속 인증 전 평문/AUTH를 거부하고 전용 서비스 사용자만 중계한다. 사설망 소속은 중계 권한을 주지 않는다. 동일 JVM 이미지·worker network namespace·실제 read-only CA/자격 파일을 사용하는 disposable Java probe가 AUTH 후 QUIT만 수행한다. MAIL/RCPT/DATA나 외부 시험 메일은 전송하지 않는다.

공통 세션의 후속 전환 순서:

1. worker와 동일한 이미지/CA/자격으로587 검증을 실행한다.
2. 해당 프로젝트의 승인된 배포에서 `DAMGOX2_MAIL_PORT=587`로 변경한다. 필요하면 worker를 `platform_default`에 연결한다. host·CA·서비스 계정은 유지한다.
3. 새 worker의 실제 연결과 재시작을 확인한 뒤, 남은 소비자의2525/2587 및 이전 웹URL 사용을 조사한다.
4. 모두 전환됐을 때 별도 변경으로 호환 listener, `mailbox-compat` 네트워크 연결·고정IP, 이전 웹 포트 및 관련 env를 정리한다. 다섯 데이터 볼륨은 삭제하지 않는다.

## 데이터·권한·TLS 계약

다섯 실제 external volume 이름은 `mailbox-store`, `smtp-queue-store`, `smtp-auth-store`, `mailbox-account-store`, `webmail-data-store`다. 각각 Maildir, Postfix spool, SASL socket, 계정 원본, Webmail 데이터를 보존한다. UID/GID5000(vmail), Postfix UID100/GID1500, postdrop GID102, mapbuilder UID5010을 고정했다. 공유 socket은 root:GID1500/0660, 상위 디렉터리는0750이다.

새 entrypoint는 기존 메일/계정/데이터를 재귀 chown하지 않는다. 공유 identity/mode가 맞지 않으면 실패한다. 필요한 초기 디렉터리만 만든다. SMTP master/virtual의 UID 전환·배달·signal 권한은 유지하고, 표준 low port에 필요한 NET_BIND_SERVICE를 추가한다. 초기화 전용 권한은 실행 전에 drop하며 mapbuilder의 UID5010과 capability0을 유지한다. Webmail은 UID5000/capability0으로 실행한다. root 역할을 위험 수용 승인으로 간주하지 않는다.

공개 수신25/2525는 STARTTLS를 제공하고 AUTH를 제공하지 않으며 외부 중계를 거절한다. 제출587/2587은 TLS 필수·전용 SASL 계정만 허용한다. Webmail은 `requireTLS`, CA·hostname 검증과 no-fallback을 유지한다. MTA 외부 배달도 `smtp_tls_security_level=verify`다. 인증서와 CA, 기존 BLF-CRYPT/Argon2id hash 및8~128자 정책은 유지한다. Dovecot은2.4 설정과 `dovecot_storage_version=2.3.0`으로 index/rollback 호환성을 보존한다.

## 격리에서 발견·보완한 사항

- 기존 Webmail PID1은 SIGTERM 종료 시험에서137로 끝났다. 새 코드는 HTTP 요청을 drain하고 Next server를 닫아 종료코드0을 남긴다. Nginx는 SIGQUIT로 graceful stop한다. 컨테이너 grace period를 설정했다.
- 기존 importer는 new/cur 이동과 `:2,` 읽음 flag 변경을 서로 다른 메일로 인식할 수 있었다. 비교용 identity만 안정화하고 원래 ledger key를 보존한다. 현재 raw path alias를 추가하므로 Alpine rollback도 인식한다. 기존 cached message ID·본문·첨부·메타데이터를 삭제하거나 합치지 않는다. 같은 process의 동시 SSR import는 한 batch로 직렬화하고 ledger는 소유권·mode를 확인해 atomic rename한다.
- SMTP 프로세스가 준비되기 전에 HTTP만 준비되는 상황을 확인해, fixture 및 운영 gate는 검증된 실제 SMTP TLS/AUTH까지 기다린다.

## 보안 패키지와 최종 검사

Upstream 숫자만 비교하지 않았다. Ubuntu26.04의 실제 설치 revision 및 공식 USN과 대조했다.

| component | 설치/하한 revision | 공식 수정 근거 |
| --- | --- | --- |
| Postfix |3.10.6-4ubuntu2.2 (최소3.10.6-4ubuntu2.1 수정 포함)|[USN-8253-1](https://ubuntu.com/security/notices/USN-8253-1), CVE-2026-43964 |
| Dovecot2.4 |1:2.4.2+dfsg1-3ubuntu2.1|[USN-8365-1](https://ubuntu.com/security/notices/USN-8365-1), 인증 pipeline/SCRAM/Sieve/ACL/bracing 수정 |
| Nginx |1.28.3-2ubuntu1.12|[USN-8955-1](https://ubuntu.com/security/notices/USN-8955-1), alias/map/HTTP3/AIO/session 관련 수정 |

Trivy0.76.1 DB UpdatedAt `2026-11-09T00:56:17.155719746Z`로 전체 severity를 검사했다. ignore, severity filter, ignore-unfixed를 쓰지 않았다. proxy의 gettext Java archive는 Java DB도 받아 검사했다. archive의 실제 Docker image/index→platform manifest→config digest를 원시 scan metadata와 연결했다. 실제 OS·Node·패키지 profile을 read-only container에서 재검증했다.

| image | 최종 image ID | MEDIUM / LOW |
| --- | --- | --- |
| smtp-receiver | `sha256:4cec1b75ee330042047bb916aeef49f9a4b91df15f63ef0a47eab0390c40f2c0` | 34 / 5 |
| imap-mailbox | `sha256:d5aee01a245e72531869757d78cb0301cbcff6a3776b0ffc3707d69b0804bbed` | 33 / 5 |
| webmail-ui | `sha256:8a1412f946588291234562e6300886cceaa441ef0242ff72ea0bc24991c8c318` | 31 / 4 |
| webmail-proxy | `sha256:bc537b637ff3d702353912ca8b5ae00279659c7445d37ef6811986e59bddcc7b` | 31 / 4 |

**HIGH0/CRITICAL0이나 전체0은 아니다.** 원시 MEDIUM129/LOW18, 총147행이 남고 수정 버전 필드가 없다. 여러 바이너리/이미지의 같은 source CVE 중복과 고유 CVE를 구분한 원시 결과를 보관한다. glibc의 `fopen` mode 입력·nscd, dash/파일 도구·POD formatter, Cyrus DIGEST-MD5 client 등 조건부 구성 요소가 포함된다. 이 배포는 nscd·journald daemon·DIGEST-MD5 client를 사용하지 않으며, 서비스가 메일을 shell/POD/tar restore 입력으로 실행하지 않는다. 이것은 패치 완료 판정이나 전체 위험 수용이 아니다. Ubuntu의 수정 미제공 항목은 남은 문제로 인계하고 실제 feature/설정 변경 시 다시 판단한다. 예: [glibc fopen](https://ubuntu.com/security/cves/CVE-2026-18374.json), [nscd](https://ubuntu.com/security/cves/CVE-2026-89092.json).

Node24.22.2는 현재24 release다. [11월11일 HIGH 보안 release 사전 공지](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)는 CVE/수정 버전 공개 전으로 별도 대기다. scanner0과 미공개 수정의 해결을 혼동하지 않는다.

## 검증과 실제 교체 절차

로컬 증거는 ignored `.agents/ubuntu-platform-20261109/reports/`에 있다. 보호 백업은 같은 task의 `backups/`(directory0700/file0600)다. runtime data와 secret은 Git에 포함하지 않는다.

- 최종 Ubuntu Node24 이미지에서 단위39개 및 production Next build 통과.
- 기존 Alpine→Ubuntu→Ubuntu 정상 종료/재시작→Alpine rollback→Ubuntu roundtrip. 분리된 계정6개, Maildir1통, 읽음 표시 설정/해제, UIDVALIDITY/UID, 공유 socket/mode, 보류 큐1건 및 기존 cache 파일을 보존했다. 마지막에 held message를 로컬로만 배달해 Maildir/Webmail2통을 확인했다. 다섯 동시 SSR도 count가 같았다.
- 8자/ASCII128자/한글128자·기존 bcrypt 인증, 잘못된 마지막 문자와 잘못된 길이·NUL 거부, 일반 사용자와 서비스 계정 중계 경계, 새/옛 listener, 잘못된 CA·hostname, Secure cookie를 검사했다.
- 네 최종 서비스가 모두 exit0으로 정상 종료했다. 이전 PID1의 decommission은 proxy drain 후 container-local shutdown channel로 HTTP를 닫고 exit0을 확인한다. 임시 channel은 외부에 공개하지 않고 닫는다. 이 일회성 운영 helper는 커밋하지 않는다.

운영 교체는 `/Users/kkkk/Desktop/jskang/03.workspace/01.project/operations/run/deploy.lock`의 같은 inode에 실제 macOS `flock(2)`를 보유한 동안만 수행한다. 별도 contender가 nonblocking lock을 획득하지 못하는 것으로 검증하고 교체·검증·재시작·필요시 rollback이 끝날 때까지 유지한다. PID 파일이나 marker로 대체하지 않으며 lock 파일을 삭제/교체하지 않는다.

1. 현재4개 container ID/image/config/mount/네트워크IP와 client를 캡처한다. 새 포트 충돌·image scan·fixture 결과·guard를 확인한다.
2. proxy를 drain한 뒤 이전 Webmail의 restart policy를 잠시 `no`로 바꾸고 HTTP를 drain한다. 자체 exit0이 `unless-stopped`에 의해 즉시 재기동되지 않도록 하기 위한 조치다. IMAP·SMTP도 정상 종료한다. 일관된 mail/account/queue/metadata/권한 snapshot 및5개 volume tar를 만든다. 인증서·이전 `.env`·inspect·복구 image ref를 보호한다.
3. 이전 컨테이너는 제거하지 않고 이름만 바꿔 보존한다. 기존 SMTP endpoint의 IP를 해제하고 새 컨테이너에 전달한다. 비밀값은 유지하고 `.env`의 Compose/image/포트 설정만 교체한다.
4. 새 SMTP/IMAP/Webmail을 같은5개 볼륨으로 기동하고 데이터/권한·TLS·SASL·실제 worker2587/587을 먼저 검증한다. proxy를 기동해 새/옛 웹URL과 로그인·cookie를 확인한다.
5. 이4개 서비스만 명시해 정상 종료/재시작한다. 원본 hash·UID/flag·계정·queue·기존 cache 파일 및 ledger 원본 항목, 인증서·인증 설정을 다시 대조한다. 다른 컨테이너 ID/image/StartedAt도 확인한다.

실패하면 새 MailBox 컨테이너만 정상 정지/제거하고 보호한 `.env`, 원래 컨테이너 이름·이미지·Webmail의 원래 restart policy·기존 SMTP IP 연결을 복원해 같은 영속 데이터로 시작한다. 정상 배달된 새 메일을 덮어쓰는 무조건적인 volume restore는 하지 않는다. 데이터 복구가 필요하면 서비스를 정지한 동일 잠금 안에서 보호 tar의 hash와 snapshot을 먼저 확인하고 문제 파일/볼륨 범위를 확정한다. `down -v`, 전체 prune, 다른 프로젝트 stop, 재귀 chown은 사용하지 않는다.

## 운영 결과

2026-11-09 **14:52 KST** 운영 교체 및 재시작 검증 완료. 실제 Docker Desktop Linux ARM64 daemon에서 아래 네 컨테이너가 위 표의 최종 검사 image ID로 실행된다. 모두 Compose project `platform`, 비정상 재시작0, 정상 종료 시험 exit0이다.

| container | 실제 container ID 앞12자 | 실행 package/runtime |
| --- | --- | --- |
| mailbox-smtp-receiver | `4b911125af40` | Ubuntu26.04.1 / Postfix3.10.6-4ubuntu2.2 / Node24.22.2 |
| mailbox-imap-mailbox | `2e7a8bf9a051` | Ubuntu26.04.1 / Dovecot2.4.2+dfsg1-3ubuntu2.1 |
| mailbox-webmail-ui | `1f5477dd250d` | Ubuntu26.04.1 / Node24.22.2 |
| mailbox-webmail-proxy | `96dbb37894b6` | Ubuntu26.04.1 / Nginx1.28.3-2ubuntu1.12 |

원래 계정2개, Maildir5통, 대기 큐0건을 교체 전후 및 재시작 후 대조했다. 원래 메일 내용·읽음 flag·UIDVALIDITY2개·기존 UID mapping·Webmail 파일21개·기존 import ledger5항목·계정 hash·파일 소유권/mode·인증서/CA·인증 secret을 보존했다. 다섯 volume 이름과 mount 경로는 그대로다. 공유 소켓 root:1500/0660을 확인했다.

실제 `platform-damgox2-worker-1`의 Temurin JRE25.0.5 이미지(`sha256:9ac4289f24e5ab05c1bd93c831eaac8fb254c51e3b186b69d14bcd56f9f8b911`)와 network namespace, read-only CA/자격 파일로2587/587 모두 CA·hostname·STARTTLS·AUTH 검증을 통과했다. worker 자체는 수정/중지/재시작하지 않았다. 공개25의 비신뢰 외부 중계 거부, 제출 TLS/인증 경계, IMAP 기존 계정, 새/옛 HTTPS 로그인·inbox·Secure cookie, 잘못된 CA/hostname 거부, loopback API를 교체 후와 재시작 후 모두 확인했다. 외부 수신자에게 시험 DATA를 보내지 않았다.

공유 잠금 inode `25825009`를 교체·검증·재시작 내내 보유했고 별도 contender의 획득 실패를 확인했다. 작업 후 잠금을 해제하며 파일은 삭제하지 않는다. 다른 운영 컨테이너10개는 ID/image/StartedAt/running이 모두 동일했다. 앞선 중단 시도는 정상 자동 복구됐고 최종 성공까지의 감사 기록은 `deploy-audit.jsonl`에 남겼다.

### 보존된 복구 자원

보호 디렉터리: `.agents/ubuntu-platform-20261109/backups/`(0700, 파일0600). 최종 일관된 volume tar는 `volumes-2026-11-09T05-51-33-218Z/` 아래 다섯 `*-store.tar.gz`이며 `reports/backup-inventory.json`에 SHA256과 크기가 있다. 원래 `.env`는 `production-before.env`, 서버 인증서·키는 `server-certificates/`, 원래 네 container 설정은 각 `*.inspect.json`에 있다. CA 개인키는 읽거나 복사하지 않았다. 이 자료를 Git/PR에 첨부하지 않는다.

이전 컨테이너 네 개를 `<원래이름>-rollback-ubuntu-20261109`로 정지 보존했다. 이전 image ref는 `<원래이름>:rollback-ubuntu-20261109`이며 원래 image ID는 `reports/production-before.json`과 protected inspect에서 확인한다. 이전 Webmail은 자동 재시작 방지를 위해 restart policy `no` 상태로 보존했고, 복원할 원래 policy는 `unless-stopped`다. 이전 SMTP는 기존IP 인계를 위해 `mailbox_default`에서 분리했다. 다른 이전 컨테이너는 제거하지 않았다.

복구 시에는 다음 순서를 **같은 공유 파일 잠금 안에서** 수행한다.

1. `deployment-summary.json`의 새/이전 ID와 현재 상태·mount를 비교한다. 현재 계정·메일·큐를 새로 snapshot/백업하고 신규 메일을 덮어쓰지 않는다. Git checkout만으로 복구하지 않는다.
2. 현재 proxy(SIGQUIT, 최대5분)→Webmail(60초)→IMAP/SMTP를 정상 종료하고 exit0을 확인한다. 이번에 생성한 네 새 컨테이너만 제거하거나 별도 이름으로 정지 보존하며 volume을 삭제하지 않는다. 새 SMTP를 `mailbox_default`에서 분리해 `172.25.0.2`를 해제한다.
3. 보호한 `production-before.env`를 원래 mode로 복원한다. 네 이전 컨테이너의 이름을 원래대로 돌리고, 이전 SMTP를 alias `mailbox-smtp-receiver`/IP `172.25.0.2`로 `mailbox_default`에 다시 연결한다. 이전 Webmail의 restart policy를 `unless-stopped`로 복원한다.
4. 보존된 이전 SMTP/IMAP/Webmail/proxy를 같은 영속 volume으로 순차 기동한다. 원래 포트25/143/18080/18443과 내부2587, 이전 CA/hostname/SASL을 검증한다. 현재 `.env`와 새/옛 Compose 파일을 섞어 자동 recreate하지 않는다.
5. 원본·복구 직전 메일/UID/flag·계정 hash·큐·소유권과 실제 worker 연결을 대조한다. volume tar 복원은 확인된 데이터 손상 범위에만 별도 적용하고 최신 정상 메일을 무조건 덮어쓰지 않는다. 검증 완료 후 잠금을 해제하며 lock inode는 보존한다.

작업 내 일회성 잠금/전환 helper는 ignored task 경로에 보존하며 런타임 비밀 자료와 함께 커밋하지 않는다. `deploy.mjs`는 완료된 전환을 다시 실행하는 복구 도구가 아니다. 복구는 위의 보존 컨테이너와 실제 현재 상태를 기준으로 수행한다.

GitHub 작업은 `codex/mailbox-ubuntu-platform-20261109` feature branch의 guarded human commit/push다. develop/main merge는 요청하지 않았으므로 수행하지 않는다.
