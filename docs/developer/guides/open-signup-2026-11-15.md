# 가입 코드 없는 회원가입 전환

2026-11-15부터 회원가입은 사용자 ID와 비밀번호로 공개 제공한다. 가입 화면의 코드 입력란, 서버의 코드 비교와 시작 시 코드 필수 검사를 제거했다. 신규 비밀번호는 기존과 같이 8~128자이고 NUL 문자는 사용할 수 없다. 기존 ID의 중복 가입, 이전 `users.json` 계정의 원래 비밀번호 확인, 계정 파일의 잠금·원자적 갱신·복구 journal은 유지한다. 가입·로그인 성공과 실패는 기존 JSON Lines 감사 이벤트로 기록하며 비밀번호와 세션 값은 기록하지 않는다.

세 Compose 정의와 `.env.example`, SMTP 계정 bootstrap에서 `WEBMAIL_SIGNUP_TOKEN` 의존성을 제거했다. 기존 환경 파일에 이 값이 남아 있어도 새 코드에서는 사용하지 않는다. `WEBMAIL_SESSION_SECRET`, SMTP 서비스 자격, TLS/CA 검증, `Secure`·`HttpOnly`·`SameSite=Lax` cookie는 그대로 사용한다. 기존 계정과 비밀번호 hash를 변환하거나 재설정하지 않는다.

## 검증

- Ubuntu 26.04.1 / Node 24.22.2 최종 이미지의 production Next build와 단위 테스트47개 통과.
- 네트워크 `none`과 전용 synthetic account/data 볼륨에서 가입 검사28개와 정상 종료·재시작 후18개 통과. 운영 데이터는 mount하지 않았다.
- 코드 환경변수와 form field가 없는 상태에서 가입, 8자·128자 한글 비밀번호, 로그인, 잘못된 비밀번호·길이·NUL·ID 거부, 중복 가입에 의한 hash 변경 거부, 기존 ID 탈취 거부, 기존 비밀번호를 증명한 이전 계정 전환, `Secure` 서명 세션을 확인했다.
- 가입·로그인 성공/실패 감사 이벤트와 테스트 자격의 로그 미포함을 확인했다. 검사 helper가 stdout만 읽어 WARN 이벤트를 놓친 첫 시도는 stdout/stderr를 함께 수집해 재검증했다. 애플리케이션 수정은 추가하지 않았다.
- 세 Compose를 코드 환경변수 없이 해석했다. `tests/platform/signup-check.mjs`는 fixture 전용 gate와 domain 검사를 통과한 격리 환경에서만 실행한다.
- 최종 이미지 archive→manifest→config digest와 Trivy 검사 결과를 대조했다. Trivy0.76.2의 DB는2026-11-15 04:00 KST 갱신판이며 HIGH0/CRITICAL0이다. 남은 원시 행은 MEDIUM17/LOW4/UNKNOWN1, 고유 CVE12개다.22행 중21행에는 수정 버전이 제시되지 않았다. 남은 항목을 해결된 것으로 취급하지 않는다.
- 격리 컨테이너1개·전용 볼륨2개·테스트 환경 파일을 제거했다. 외부 실제 수신자에게 시험 메일을 보내지 않았다.

## 실제 운영 반영

2026-11-15 **05:17 KST** 운영 교체와 정상 재시작 검증을 완료했다. Docker Desktop `desktop-linux`의 실제 socket과 `linux/arm64`를 사용했다. 프로젝트 전용 기존 Ubuntu Node24 base를 `NODE_IMAGE=mailbox-node24:ubuntu26.04-20261109-r3`로 받아 새 웹메일 이미지를 빌드했다. 공통 이미지 tag를 덮어쓰지 않았다.

| 항목 | 실제 값 |
| --- | --- |
| Compose 프로젝트 / 서비스 | `platform` / `mailbox-webmail-ui` |
| 컨테이너 | `mailbox-web` (`9fa187b35cc1`) |
| 이미지 tag | `mailbox-webmail-ui:open-signup-20261115-r1` |
| 이미지 ID | `sha256:ed89cbe7f6879f66cb2a62645fecd41d7453102125ba8a40ae48c44f39df78ad` |
| 이미지 config digest | `sha256:3622d195f559cbe634a4b376c15d1a87fbbd41db04b0c3dc6e735f846922660e` |
| 실제 HTTPS | `https://175.195.62.165:20005` |
| 기존 HTTPS 별칭 | `20006`에서 HTTPS20005로 이동 |
| 진단 endpoint | `127.0.0.1:20105 -> 3000` |
| 네트워크 | `platform_edge-mail`, `platform_mailbox-backend` |

현재 공통 edge Nginx가 TLS를 처리하므로 `mailbox-web`만 교체했다. 공통 Nginx·SMTP·IMAP을 포함한 나머지17개 컨테이너의 ID/image/StartedAt/running을 보존했다. `operations/`와 다른 프로젝트 파일은 변경하지 않았다. 저장소 standalone Compose의 HTTP20005/HTTPS20006 설정은 현재 공통 edge의 HTTPS20005/별칭20006 구성과 구분한다.

공유 잠금 `/Users/kkkk/Desktop/jskang/03.workspace/01.project/operations/run/deploy.lock`의 같은 inode25825009에서 실제 macOS `flock(2)`를 보유했다. 독립 contender가 잠금을 획득하지 못하는 것을 확인하고 백업·교체·검증·재시작까지 유지했다. 교체 전 TLS 음성 검사에서 HTTP client의 연결 재사용을 배제하도록 helper를 보완했다. 새 연결에서 잘못된 CA와 호스트명이 모두 거부된 후 운영 교체를 진행했다.

기존 계정2개·Maildir5통·queue0건·Webmail 파일21개·import ledger5항목과 소유권/mode150항목을 대조했다. 다섯 볼륨 `mailbox-store`, `smtp-queue-store`, `smtp-auth-store`, `mailbox-account-store`, `webmail-data-store`와 원래 mount·네트워크·포트를 보존했다. 인증 소켓은 root:1500/0660이다. Webmail은 UID5000/capability0과 V8 old/semi-space512/16MiB로 실행하며 OOM·비정상 종료·자동 재시작은 없었다.

실제 HTTPS에서 가입 화면과 코드 없는 입력 검사를 확인했다. 운영에서는 유효하지 않은 비밀번호만 제출해 검사 경로를 확인했으며 테스트 계정을 만들지 않았다. 기존 계정의 로그인·받은메일, TLS 인증서/호스트 검증과 잘못된 CA/호스트 거부, SMTP/IMAP 인증 및 TLS 정책을 검증했다. 실제 `damgox2-worker`의 같은 JVM image/network namespace와 read-only CA/자격 파일로 기존2587의 STARTTLS/CA/호스트/AUTH 후 QUIT를 확인했다. 이 client probe는 MAIL/RCPT/DATA를 보내지 않는다.

## 운영 재현과 복구

보호 자료는 ignored `.agents/open-signup-20261115/` 아래에 보존한다(directory0700, 비밀 파일0600). `backups/original-web.inspect.json`, `backups/runtime-before.compose.json`, `backups/runtime-open-signup.compose.json`에는 실제 자격·환경값이 포함되므로 Git/PR/로그에 붙이지 않는다. 설정에는 현재 웹메일 서비스만 포함하며 원래 네트워크와 볼륨은 external로 참조한다. Compose 문자열의 `$`는 literal로 보존해 실제 환경값이 변하지 않도록 했다.

정상 종료한 웹메일이 유일한 계정/cache writer인 상태에서 `backups/volumes-2026-11-14T20-16-13-846Z/`에 `mailbox-account-store`와 `webmail-data-store`의 일관된 tar 백업을 만들고 hash·tar header를 검증했다. Maildir·queue·인증 소켓은 SMTP/IMAP이 계속 사용하므로 정적인 전체5볼륨 백업이라고 주장하지 않는다. 백업 내역과 SHA256은 `reports/backup-inventory.json`을 확인한다.

공통 운영의 다음 recreate 때도 새 웹메일 이미지와 원래 mount·환경·네트워크·포트를 사용해야 한다. 이 작업은 공통 `operations/edge/runtime.compose.json`을 수정하지 않았으므로 공통 파일의 이전 image로 recreate하면 이전 코드로 돌아갈 수 있다. 새 내부 endpoint는 기존 `mailbox-web:3000`이며 client endpoint는 변경하지 않았다. 현재 운영 재현용 모델은 `backups/runtime-open-signup.compose.json`, 해당 Compose의 환경 파일은 `backups/empty.env`다. 프로젝트명 `platform`에서 `--no-deps --no-build --pull never`와 서비스 `mailbox-webmail-ui`만 선택한다.

복구 시 같은 공유 잠금을 보유하고 현재 컨테이너 ID/image를 검증한다. 웹메일만 정상 종료하고 volume 제거 없이 컨테이너만 제거한 뒤, `backups/runtime-before.compose.json`과 `backups/empty.env`로 이전 웹메일을 시작한다. 복구 image ref `mailbox-web:before-open-signup-20261115`는 `sha256:9227e6e4f93c836815b49a7102931059cc9dfdfac11d66abeb0adc5701825d5b`를 가리킨다. 복구 후 HTTPS·기존 계정·SMTP TLS/SASL·메일·UID/flag·소유권·client를 다시 대조한다. 계정·메일을 무조건 tar로 덮어쓰지 않는다. 완료된 일회성 `deploy.mjs`를 다시 실행하는 것을 복구 절차로 사용하지 않는다.

`down -v`, 전체 prune, 다른 프로젝트 stop, 공통 Nginx restart, 재귀 chown은 수행하지 않았다. 일회성 배포/잠금 helper와 비밀 백업은 ignored 경로에만 남기며 커밋하지 않는다. 원시 검증 결과는 `reports/deployment-summary.json`, `production-after-preserved.json`, `restart-web.json`, `restart-consumer.json`, `untouched-after.json`, `deploy-lock-proof.json`에서 확인한다.
