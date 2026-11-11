# MailBox 메모리·성능 최적화

2026-11-11, Sprint Delivery. 기존 Ubuntu26.04·Node24, 비밀번호8~128자와 hash profile, TLS/CA/hostname 검증·SASL·중계 제한을 유지한다. 실제 운영은 `operations/compose.yaml`의 `platform` 프로젝트이며 컨테이너 이름은 `mailbox-web`, `mailbox-proxy`, `mailbox-smtp`, `mailbox-imap`이다. 이 작업은 MailBox checkout만 수정하며 공통 운영 파일은 수정하지 않는다.

## 변경

- Maildir·drop 입력은 `MailParser`와 파일 stream으로 처리한다. 첨부파일은 backpressure를 적용해 바로 저장하고 저장이 끝난 뒤 parser를 release한다. 원본 RFC822 Buffer와 전체 첨부 Buffer를 동시에 만들지 않는다. 기존 CID→data URI 변환은 라이브러리의 같은 변환/한도를 사용하며 필요한 inline image만 다시 읽는다. MIME 파일명은 저장 경로로 사용하지 않는다.
- 변환 중에는 같은 volume의 새 staging 디렉터리를 사용한다. 실패하면 자신이 만든 미완성 디렉터리와 stream만 정리한다. 기존 cache·계정·메일·import ledger 원본을 삭제하거나 포맷을 바꾸지 않는다. 동시 drop 조회도 한 batch를 공유해 중복 가져오기를 막는다.
- 목록의 metadata 읽기는 요청당 최대32개, Maildir source 열거는 최대4개로 제한한다. 날짜 정렬과 기존 접근 필터는 유지한다. 메타데이터와 본문을 영구 메모리 cache에 보관하지 않는다. 기존 메일 목록만 볼 때는 MIME library를 늦게 로드한다.
- Webmail V8 old-generation은512MiB, semi-space는16MiB를 기본값으로 쓴다. 이는 **프로세스 RSS나 컨테이너 전체 메모리 상한이 아니다**. TLS, stream buffer, Argon2의 native64MiB/작업 등은 별도다. 인증 비용을 낮추거나 Docker hard limit으로 프로세스를 강제 종료하는 방식은 쓰지 않았다.
- Nginx 기본 worker는2개이며 worker당 upstream keepalive8개를 둔다. `auto` 또는1~128로 변경할 수 있다. 요청/응답 buffering 비활성화, streaming upload, timeout, TLS와 감사 로그는 유지한다.

근거: [MailParser stream/release API](https://nodemailer.com/extras/mailparser), [Node24 V8 옵션](https://nodejs.org/docs/latest-v24.x/api/cli.html#--max-old-space-sizesize-in-mib), [Nginx worker 설정](https://nginx.org/en/docs/ngx_core_module.html#worker_processes).

## 측정

Docker Desktop Linux ARM64/Engine29.9.2, Node24.22.2에서 분리된 합성 데이터로 비교했다. 개인 메일을 부하 시험에 사용하지 않았다. 수치는 로컬 보호 증거 `.agents/performance-20261111/reports/performance-summary.json` 및 raw trial에서 계산한 중앙값이다.

| 항목 | 이전 | 최종 | 변화 |
| --- | ---: | ---: | ---: |
| Webmail working set, 부하 후 |1140.6MiB|224.8MiB|약80.3% 감소|
| Nginx working set, 부하 후 |11.9MiB|6.4MiB|약46.3% 감소|
| 받은메일 p95 |347.8ms|241.8ms|약30.5% 감소|
| 받은메일 처리량 |39.28req/s|37.60req/s|약95.7% 유지|
|32MiB 첨부 처리 최대 RSS|388.2MiB|128.9MiB|약66.8% 감소|
|32MiB 첨부 처리 시간|600.1ms|467.7ms|약22.1% 감소|

HTTP는 cached mail201개, 동시8요청, 같은 fixture/CA/계정, phase마다48회 warm-up 후 trial당96회다. 이전 이미지는 순서를 바꾼6개 trial, 최종 r3 이미지는3개 trial을 사용했다. 두 phase의 baseline 처리량 범위는30.44~42.75req/s, 최종은36.95~38.37req/s다. 다른 상시 운영 작업과 GC의 변동이 있으므로 처리량 향상이나 통계적 동등성을 주장하지 않는다. 허용 기준은 처리량90% 이상, p95 지연15% 이내였으며 통과했다. MIME는 같은32MiB 바이너리·같은 Node/dependencies/입출력으로 fresh process에서 각3회 비교하고 저장한 첨부의 byte count/SHA256이 모두 같은지 확인했다.

working set은 cgroup usage에서 inactive file cache를 뺀 값이다. PID1 RSS/HWM과 swap도 별도로 기록했다. cold 운영 프로세스의 RSS와 warmed fixture를 직접 비교하지 않는다. 위 수치는 **해당 workload의 비교**이며 모든 mailbox 크기·동시성의 전역 최소값이 아니다. 큰 mailbox나 여러 대용량 본문을 동시에 조회하는 운영은 같은 probe로 다시 측정해 `WEBMAIL_NODE_OPTIONS`와 worker 수를 조절한다.

## 검증

- 실제 최종 runtime image에서 단위47개 통과, production Next build 통과. 테스트 scratch는 `MAILBOX_TEST_TMP`와 `TMPDIR`로 허용된 작업 경로에 둔다.
- 별도5개 fixture volume과 internal network를 사용했다. cached mail201개에서 시작해32MiB 첨부 추가,49MiB plain mail, 동시 drop import, held mail의 로컬 배달 후205개를 확인했다. Maildir은1→4통이다.
- 원래 계정·메일·UID/읽음·기존 Webmail 데이터605개 파일·ledger·소유권과 root:1500/0660 socket을 대조했다. 보류 큐1건은 새 이미지의 정상 종료/재시작, 이전 이미지 rollback 및 새 이미지 복귀 동안 byte 단위로 보존했다. 마지막에만 로컬 수신자에게 release했다.
-49MiB 본문 파싱뿐 아니라 실제 상세 화면 응답118,583,803byte를 streaming으로 읽어 완료했다. 두32MiB 첨부 다운로드도 원본과 byte count/hash가 일치했다. 미인증·다른 계정의 첨부 접근을 거부했다.
- TLS 없는 제출/IMAP 로그인, 비인증·오인증·일반 계정의 외부 relay, 잘못된 CA/hostname 거부와 Secure/HttpOnly/SameSite cookie를 확인했다. 시험 DATA는 `fixture.test` 내부 수신자만 사용했다.

재사용 probe는 `tests/performance/`에 있다. `http-benchmark.mjs`는 fixture 계정과 제한된 로컬 endpoint만 받는다. `mime-benchmark.mjs`는 `MAILBOX_PERF_ROOT` 아래 input/output만 사용한다. `data-snapshot.mjs`는 대용량 파일도 stream으로 hash하고 원문·주소·계정 hash를 출력하지 않는다. `compare-snapshots.mjs`의 기본은 큐까지 strict 비교다. 운영의 `live-queue` 모드는 SMTP를 계속 실행하므로 실제 배달로 변할 수 있는 queue byte의 정적 일치를 강제하지 않는다. 대신 fixture held queue 검증, 실제 SMTP/IMAP의 동일 ID/image/StartedAt와 volume 연결을 함께 확인한다.

## 최종 이미지 검사

| 역할 | 프로젝트 전용 tag | 실제 image ID |
| --- | --- | --- |
| Webmail |`mailbox-webmail-ui:memory-20261111-r3`|`sha256:9227e6e4f93c836815b49a7102931059cc9dfdfac11d66abeb0adc5701825d5b`|
| Proxy |`mailbox-webmail-proxy:memory-20261111-r1`|`sha256:87dd5d06d05ebb08fa12b3370b8b921fbf7453003627a9836b84a06bcd92bd78`|

두 최종 이미지는 Ubuntu26.04.1이다. Webmail은 Node24.22.2, proxy는 Ubuntu 보안 revision `nginx1.28.3-2ubuntu1.12`다. Trivy0.76.2 DB UpdatedAt `2026-11-10T19:01:23.081219346Z`, DownloadedAt `2026-11-11T11:06:42.636548Z`로 검사했다. ignore/severity filter/ignore-unfixed를 사용하지 않았고 Java DB도 포함했다. OCI index→ARM64 manifest→config digest와 scanner ImageID, 현재 daemon image ID를 연결해 확인했다.

**HIGH0/CRITICAL0이며 전체0은 아니다.** Webmail MEDIUM42/LOW4(고유 CVE36), proxy MEDIUM34/LOW4(고유 CVE29), 합계84행이 남는다. 모두 scanner의 수정 버전 필드가 없다. 이미지/패키지 간 중복 행을 전체 고유 CVE 수로 오인하지 않는다. 이 결과를 전체 위험 수용이나 예정된 Node 보안 릴리스 해결로 간주하지 않는다. 변경하지 않은 SMTP/IMAP을 이번에 교체하거나 재검사했다고 주장하지 않는다.

## 빌드와 공통 운영 연결

공통 tag를 덮어쓰지 않고 고유한 프로젝트 tag로 빌드한다. `NODE_IMAGE`는 검증된 Ubuntu26.04/Node24 공통 기반을 받으며, 없으면 기존 프로젝트 Node24 fallback을 먼저 빌드할 수 있다.

```sh
docker build --build-arg NODE_IMAGE=platform/node24:ubuntu26.04-20261109-r2 \
  -t mailbox-webmail-ui:memory-20261111-r3 -f webmail-ui/Dockerfile webmail-ui
docker build -t mailbox-webmail-proxy:memory-20261111-r1 \
  -f webmail-ui/Dockerfile.proxy webmail-ui
```

다른 시점에 재빌드한 이미지는 같은 tag라도 검사와 검증을 다시 한다. 최종 선택은 tag 문자열보다 image ID로 확인한다.

`compose.performance.yaml`은 기존 standalone 또는 공통 Compose **뒤에 추가하는 override**다. 공통 파일을 수정하지 않고 두 서비스의 이미지·힙·worker·grace period만 조합한다.

```sh
MAILBOX_PERF_WEB_IMAGE=mailbox-webmail-ui:memory-20261111-r3 \
MAILBOX_PERF_PROXY_IMAGE=mailbox-webmail-proxy:memory-20261111-r1 \
docker compose -p platform -f ../operations/compose.yaml \
  -f compose.performance.yaml config --quiet
```

실제 교체는 아래 공유 잠금 안에서 검증된 이미지로 두 service만 `up --no-deps --no-build --pull never` 한다. SMTP/IMAP이나 다른 platform service를 선택하지 않는다. 이후 공통 세션도 이 override/tag를 함께 사용해야 현재 최적화 이미지를 유지한다. 공통 파일만으로 이전 image tag를 recreate하면 이전 이미지로 돌아갈 수 있다. 현 세션은 공통 tag나 공통 설정을 덮어쓰지 않는다.

환경 조정:

- `WEBMAIL_NODE_OPTIONS`: 기본 `--max-old-space-size=512 --max-semi-space-size=16`. 필요하면 검증 후 늘릴 수 있다. Argon2 비용은 조정하지 않는다.
- `NGINX_WORKER_PROCESSES`: 기본2, `auto` 또는1~128. 높은 TLS 동시성이 필요한 경우 다시 부하 검증한다.

## 잠금·데이터·복구

실제 macOS `flock(2)`를 `/Users/kkkk/Desktop/jskang/03.workspace/01.project/operations/run/deploy.lock`의 같은 inode에 보유한다. 별도 nonblocking contender가 실패하는 것으로 확인하고 교체·검증·재시작·필요시 rollback이 끝날 때까지 유지한다. lock 파일은 삭제하지 않는다.

운영 준비 자료는 ignored `.agents/performance-20261111/backups/`(directory0700/file0600)다. 현재 실제4개 MailBox의 inspect와, 경로가 절대값으로 해석되고 실제 네트워크/volume을 external로 참조하는 `runtime.compose.json`을 보존한다. 이 JSON에는 비밀 환경값이 있으므로 Git/PR에 첨부하지 않는다. 실제 운영의 container 이름·network·port와5개 volume을 유지하며 checkout의 standalone 설정으로 현재 공통 구성을 덮어쓰지 않는다.

교체는 proxy를 SIGQUIT로 drain한 뒤 Webmail을 정상 종료한다. Webmail이 유일한 account/cache writer인 상태에서 account/cache2개 volume을 일관된 tar로 백업하고 hash와 전체 tar header를 확인한다. Maildir·queue·auth socket은 SMTP/IMAP이 계속 사용하므로 정적인 전체 백업이라고 주장하지 않는다. 다섯 volume 모두 삭제/복원/재귀 chown하지 않는다. 새 web은 기존 Maildir을 read-only로만 mount한다.

복구 image ref는 `mailbox-web:before-memory-20261111`, `mailbox-proxy:before-memory-20261111`이다. 같은 잠금 아래 현재 두 컨테이너의 ID/image를 확인하고 정상 종료 후 **두 컨테이너만** 제거한다(volume 제거 금지). 보호된 `runtime.compose.json`만 사용해 이전 web을 `--no-deps --no-build --pull never`로 시작하고 TLS/SASL readiness 후 이전 proxy를 시작한다. 새 `.performance` override는 복구 실행에서 제외한다. 기존 mail/account/cache를 무조건 tar로 덮어쓰지 않는다. old model의 secret/mount/network/port를 유지하고 계정·메일·UID/flag·원래 cache/ledger·소유권과 실제 client를 대조한다.

일회성 배포/잠금 helper는 같은 ignored task 경로에만 보존하며 커밋하지 않는다. 완료된 `deploy.mjs`를 반복 실행하는 것을 복구 절차로 사용하지 않는다. `down -v`, 전체 prune, 다른 프로젝트 stop, 임의 worktree는 사용하지 않는다.

## 실제 운영 결과

2026-11-11 **20:55 KST** 실제 교체와 정상 재시작 검증을 완료했다. 운영 web은 `d07eb68b06db`, proxy는 `5b06a2838125`이며 위 최종 image ID로 실행한다. 두 서비스 모두 restart0, 정상 종료 시험 exit0, OOM 없음이다. Webmail PID1 UID5000/capability0, Nginx master+worker2개를 확인했다.

원래 계정2개·Maildir5통·queue0건·기존 Webmail 파일21개·ledger5항목·소유권/mode150항목과 인증서/CA/서비스 인증값을 보존했다. socket은 root:1500/0660이다. 다섯 volume 이름과 원래 mount·network·port를 유지했다. SMTP/IMAP2개와 다른 프로젝트12개는 ID/image/StartedAt/running이 동일하다. 실제 `damgox2-worker`의 같은 JVM image/network namespace와 read-only CA/자격 파일로 기존2587 TLS/hostname/AUTH 후 QUIT를 검증했다. 이 probe는 MAIL/RCPT/DATA를 보내지 않는다.

공유 잠금 inode25825009를 교체·검증·재시작까지 보유했다. 처음 시도의 마지막 `docker top` 형식 호환성 오류 때에는 자동으로 이전 이미지와 구성을 복구했고, 확인 방식을 `/proc`으로 보완한 재시도가 모두 통과했다. raw 감사 이력은 `deploy-audit.jsonl`에 보존한다.

일관된 account/cache 백업은 `backups/volumes-2026-11-11T11-54-21-369Z/`이다. 실제 디렉터리명과 SHA256은 `reports/backup-inventory.json`을 우선 확인한다. 복구 시 `backups/runtime.compose.json`과 두 `before-memory-20261111` image ref를 사용하며, `backups/performance.env`와 이 checkout의 `compose.performance.yaml`은 최적화 운영 재현용이다. 보호 JSON/환경 파일을 Git에 넣지 않는다.

보호된 `deployment-summary.json`, `production-final-preserved.json`, `production-restart-web.json`, `production-restart-consumer.json`, `deploy-others-after.json`, `deploy-lock-proof.json`에 검증 결과를 남겼다. GitHub는 요청한 feature commit/push, 현재-head 독립 App 승인과 필수 검사 뒤 develop merge 및 branch 정리 순서다. 이미지 변경 없는 Git 작업은 Docker를 다시 교체하지 않는다.
