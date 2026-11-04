# MailBox SMTP 보안 검증 — 2026-11-04

## 이미지 재검사

Trivy 0.76.1로 정확한 이미지 archive를 검사했다. 전체 심각도를 수집했으며 CVE 제외 목록, `ignore-unfixed`, 심각도 필터를 사용하지 않았다. 후속 검사는 같은 DB에서 `--skip-db-update`를 사용했다. 결과는 해당 이미지와 DB 시점에 한정된다.

기존 대상 `sha256:594e743418aadf1ed23478ba448bcb6cad5809c99858ecca9c06e43d7de12c99`에서 LOW 102 / MEDIUM 114 / HIGH 33 / CRITICAL 1 / UNKNOWN 1, 총 251행을 재현했다. HIGH·CRITICAL 34행은 CVE ID로 중복 제거하면 10종이며 `(설치 source package, CVE)`로 합쳐도 10건이다.

| 최종 이미지 | LOW | MEDIUM | HIGH | CRITICAL | UNKNOWN |
| --- | ---: | ---: | ---: | ---: | ---: |
| SMTP | 0 | 0 | 0 | 0 | 0 |
| Webmail | 0 | 0 | 0 | 0 | 0 |
| IMAP | 104 | 111 | 32 | 1 | 0 |

SMTP는 Alpine 3.24.3 / Postfix 3.11.7로 교체했다. 앱은 Next.js 16.4.5, Nodemailer 10.3.1, MailParser 3.14.1과 수정된 의존성을 사용한다. 개발 의존성과 런타임에 불필요한 npm/Yarn을 제외했다. SMTP의 Node.js는 내장 모듈만 사용하는 비권한 맵 감시기에 필요하다.

IMAP은 Dovecot 2.3 설정 호환성을 유지한 Debian 12 이미지에 SASL Unix socket을 추가했다. 원시 HIGH 32 / CRITICAL 1은 남아 있다. CRITICAL MiniZip은 설치 구성상 영향이 없다는 Debian 판정과 구분한다. IMAP의 다른 패키지 전체에 대한 영향 분석·패치를 완료했거나 MailBox 전체가 0건이라고 해석하면 안 된다.

## 기존 SMTP의 고위험 10종

| CVE | 원시 행 | 설치 구성과 조치 |
| --- | ---: | --- |
| CVE-2026-43964 | 1 | 영향 버전 Postfix 3.7.11을 수정된 3.11.7로 교체. |
| CVE-2023-45853 | 1 | zlib source 단위 검출. 설치된 MiniZip 바이너리·취약 심볼 없음. |
| CVE-2025-69720 | 3 | ncurses source 중복. infocmp CLI 문제로 SMTP 처리와 구분. 새 이미지에서 검출 없음. |
| CVE-2026-16742 | 2 | libsystemd/libudev source 중복. 취약 기능 systemd-homed 미설치. 새 이미지에 systemd 없음. |
| CVE-2026-41992 | 1 | GNU gzip LZH 처리 문제. SMTP에서 호출하지 않으며 새 이미지에서 검출 없음. |
| CVE-2026-53613 | 8 | util-linux source 중복. fstab 기반 mount 문제. 새 이미지에서 검출 없음. |
| CVE-2026-53615 | 8 | util-linux source 중복. DOS partition probing 문제. 새 이미지에서 검출 없음. |
| CVE-2026-78410 | 8 | util-linux source 중복. privileged bind mount 문제. 새 이미지에서 검출 없음. |
| CVE-2026-54369 | 1 | libacl pathname API 문제. 새 이미지에 libacl 의존성 없음. |
| CVE-2026-9538 | 1 | perl-base source 검출. 취약 Archive::Tar 모듈 미설치. 새 이미지에 Perl 없음. |

Postfix 문제는 텍스트 없는 enhanced status code의 경계 밖 읽기다. upstream은 SMTP/LMTP 서버 응답으로 재현되지 않고 access/policy 등의 경로에 영향을 준다고 설명한다. 기존 설정에 policy, milter, DNSBL 사용은 없어 인터넷 SMTP 명령만으로 악용 가능하다고 단정하지 않았다. 영향 바이너리는 수정 버전으로 교체했다. [Debian 상태](https://security-tracker.debian.org/tracker/CVE-2026-43964), [Postfix 수정 공지](https://www.postfix.org/announcements/postfix-3.11.2.html).

CVE-2023-45853은 zlib 핵심 압축 API가 아닌 MiniZip의 `zipOpenNewFileInZip4_64`에 해당한다. 정확한 기존 이미지에는 `zlib1g 1:1.2.13.dfsg-1`만 있고 `minizip`, `libminizip1`, `zlib1g-dev`가 없다. `/usr`의 MiniZip 파일과 설치 libz의 해당 심볼도 없다. Debian은 bookworm zlib의 contrib/minizip이 빌드되지 않아 해당 바이너리가 영향받지 않는다고 명시한다. 원시 scanner 결과를 숨기지 않고 영향 판정만 분리했다. [Debian 공식 근거](https://security-tracker.debian.org/tracker/CVE-2023-45853).

나머지 source 판정은 Debian tracker의 [ncurses](https://security-tracker.debian.org/tracker/CVE-2025-69720), [systemd](https://security-tracker.debian.org/tracker/CVE-2026-16742), [gzip](https://security-tracker.debian.org/tracker/CVE-2026-41992), [util-linux 53613](https://security-tracker.debian.org/tracker/CVE-2026-53613), [53615](https://security-tracker.debian.org/tracker/CVE-2026-53615), [78410](https://security-tracker.debian.org/tracker/CVE-2026-78410), [acl](https://security-tracker.debian.org/tracker/CVE-2026-54369), [Perl](https://security-tracker.debian.org/tracker/CVE-2026-9538)을 사용했다.

## 권한과 잔여 root

- 초기화 동안 CHOWN, DAC_OVERRIDE, FOWNER, SETPCAP, SETUID, SETGID, KILL만 허용한다. Docker 기본 capability는 모두 drop한다.
- master PID 1: UID 0, CapEff/CapBnd `0x00e2` = DAC_OVERRIDE, KILL, SETGID, SETUID. `NoNewPrivs=1`. 초기화용 CHOWN/FOWNER/SETPCAP은 남지 않는다.
- smtpd/qmgr: real/effective/saved UID 모두 100, GID 1500, CapEff 0.
- virtual: 대기 시 effective UID 100이며 Maildir UID 5000으로 전환하기 위한 saved root가 남는다. fixture Maildir 배달 성공을 확인했다.
- 맵 감시기: UID 5010/GID 5000, CapEff/CapBnd 0. root reload 감시기를 제거하고 원자 LMDB 교체를 사용한다.
- 공개 host 25는 container 2525로 연결한다. NET_BIND_SERVICE/SYS_CHROOT, 미사용 local/pipe/spawn 서비스, SUID/SGID 비트를 제외했다. postqueue/postdrop 권한 경고는 비권한 로컬 제출 helper를 비활성화한 결과다.

DAC_OVERRIDE를 제거한 시험에서는 queue/data 디렉터리 접근이 실패해 필요한 권한으로 한정했다. root master와 virtual의 saved root는 여전히 남아 있으며 완전한 비root 실행은 아니다. **잔여 root 권한에 대한 위험 수용 승인을 받았다고 간주하거나 기록하지 않았다.** Postfix의 지원되는 프로세스 권한 분리와 Maildir 배달을 보존하며 불필요한 권한을 줄였다. [Postfix 비권한 실행 제한](https://www.postfix.org/UNPRIVILEGED_README.html)은 파일/Maildir 배달에서 제시된 비권한 실행 방식을 production에 사용하지 말라고 설명한다.

## 제출·중계·TLS 검증

| 경로/조건 | 실제 확인 결과 |
| --- | --- |
| 기존 운영망의 별도 비인증 Docker peer → 외부 RCPT | 250. 사설망 중계 권한이 넓었음. DATA 전송 없음. |
| 새 공개 수신 → 비로컬 RCPT | 같은 사설망 peer도 거부 554. AUTH 미제공. |
| 공개 수신 → 등록된 로컬 recipient | 250, STARTTLS 제공. |
| 내부 제출 2587, TLS 전 | AUTH 미광고, MAIL 거부 530, 호스트 port 미공개. |
| TLS 후 비인증·잘못된 비밀번호 | 외부 RCPT 거부 554 / AUTH 거부 535. |
| TLS 후 유효한 일반 IMAP 계정 | 인증 성공 후에도 서비스 중계 거부 554. |
| TLS 후 전용 서비스 계정 | 제출 허용, fixture Maildir 배달 성공. |
| 앱: STARTTLS 없음/핸드셰이크 실패/신뢰 오류/호스트 불일치 | 모두 실패, AUTH·MAIL·DATA 전송 없음. 정상 검증 TLS 성공. |
| Postfix → 시험 MTA: TLS 없음/호스트 불일치/핸드셰이크 실패 | 모두 deferred, 평문 DATA 없음. |
| Postfix → 유효한 인증서의 시험 MTA | Verified TLS 및 DATA 배달 성공. |

공개 25의 `smtpd_tls_security_level=may`는 인터넷 수신 호환성을 위해 유지한다. 앱 listener는 `encrypt`, 앱 transport는 `requireTLS=true`, `rejectUnauthorized=true`, TLS 1.2 이상과 명시적 servername을 사용한다. Dovecot Unix socket은 GID 1500·0660으로 제한한다. 전용 service identity만 제출을 허용하며 사설망 trust나 sendmail fallback으로 우회할 수 없다.

외부 배달은 `smtp_tls_security_level=verify`, `smtp_tls_verify_cert_match=hostname`이다. 상대가 TLS 또는 MX 호스트 인증서 검증을 통과하지 못하면 큐에 보류한다. 전용 인증·복구 메일 기능은 현재 이 저장소에 없으며 향후 동일 제출 모듈을 사용해야 한다. [Postfix TLS 정책](https://www.postfix.org/TLS_README.html), [Dovecot/Postfix SASL](https://doc.dovecot.org/2.3/configuration_manual/howto/postfix_and_dovecot_sasl/).

기존 인터넷 오픈 릴레이 여부는 별도로 확정하지 않았다. 기존에 확인한 것은 사설망 peer의 중계 허용이다. 시험 메일 DATA는 격리된 network와 자체 Maildir/sink에서만 사용했고 실제 외부 수신자에게 발송하지 않았다.

## 증거와 재검사

로컬 `.agents/security-hardening/reports/`에 원시 Trivy JSON, 이미지 ID 연결, 패키지 목록, 단위 테스트, SMTP 권한/TLS/프로세스 검증을 보존한다. 비밀번호·토큰·개인키는 보고서와 커밋에 포함하지 않는다.

```bash
npm test --prefix webmail-ui
docker compose --env-file .env.example -f docker-compose.prod.yml config --quiet
trivy image --scanners vuln --format json --output <workspace>/reports/smtp.json <정확한-이미지-ID>
```

이미지를 다시 빌드하거나 태그가 바뀌면 해당 이미지 ID로 재검사한다. 런타임 manifest ID와 scanner config ID는 archive의 `index.json`/`manifest.json`으로 연결해 검증했다.

## Image binding evidence

DB UpdatedAt: `2026-11-04T01:28:23.13686565Z`

```json
{
  "smtp-receiver": {
    "runtimeImageId": "sha256:a2392bb2ab623efe485b6a3e9abc956aebc3930130b1350d73f8fe8a1d1df1ad",
    "scanImageId": "sha256:45a9ca8f8e068a5050adf4eb007b42ac31e406cc922864b3996e9850ed85d03f",
    "severity": {},
    "reportSha256": "6459042a0076e298a3f909f0d98858ee222e4cdf2af65056e2eaf29641c14fd6"
  },
  "imap-mailbox": {
    "runtimeImageId": "sha256:58fc5c5fb05c20ace3774c6ed303dbdca73fbe9154527fec357e668d9668836d",
    "scanImageId": "sha256:82107823e91d6d8bad58a01eaa879ffda986348257d25328e6d9d566ac4ed64b",
    "severity": {
      "LOW": 104,
      "HIGH": 32,
      "MEDIUM": 111,
      "CRITICAL": 1
    },
    "reportSha256": "a4b7a0a053bf6b4dded8f57e8a0d3dec55451f220a327ec95e1ca97c8cbd1e59"
  },
  "webmail-ui": {
    "runtimeImageId": "sha256:d0e3dabbda041a499437791f6f489a402271c5e5e02225497f8cafd03d13003a",
    "scanImageId": "sha256:fc3fb52adccd53c95f902e91ea021a3b8b60ac9386e7772ecb0116e7b34485c6",
    "severity": {},
    "reportSha256": "286f22e21089a4256ce65ebf94cbc35016d17973fc4585770359aaca0a1990bd"
  }
}
```
