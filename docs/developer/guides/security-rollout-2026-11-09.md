# 2026-11-09 보안 이미지 검증 기록

검사·빌드 기준: 2026-11-09 KST. 이 문서는 배포 후보의 검증 결과와 운영 적용 조건을 기록한다. 운영 적용 성공 여부는 실제 컨테이너 image ID와 배포 전후 상태를 별도로 대조해야 한다.

## 승인 범위와 변경

사용자가 보안 조사 결과에 대한 이미지 재빌드·재검사, 독립 리뷰 1명, develop/main 반영 및 운영 컨테이너 교체를 승인했다. 비밀번호 길이는 별도로 **8~128자**로 지정했다. 기존 계정·비밀번호·메일·큐·인증서는 보존한다.

- 네 runtime Dockerfile에 Alpine stable의 `zlib>=1.4-r0` 하한을 추가했다. 설치할 수 없으면 빌드가 실패한다.
- 기존 main의 계정 소유권 확인, 점 디렉터리 ID 차단, NUL 차단, 중단된 계정 생성 복구, 기존 SMTP 서비스 계정 우선 검증을 포함한 새 Webmail을 빌드했다.
- bcrypt의 72바이트 절단 없이 요청한 길이를 지원하기 위해 신규 계정은 Dovecot 호환 Argon2id를 사용한다. Node 내장 crypto로 PHC v19, memory 64MiB, passes 3, parallelism 1, salt 16바이트, tag 32바이트를 적용한다. Webmail은 이 고정 profile만 허용한다. 기존 BLF-CRYPT hash는 다시 쓰지 않고 그대로 검증한다.
- 길이 계산은 기존 JavaScript 문자열 및 HTML min/maxLength 기준을 유지한다. 한글 128자는 허용되며 바이트 수로 줄이지 않는다. NUL은 공용 SASL 인증 형식 때문에 허용하지 않는다.

## 발견 항목의 판단

| 항목 | 확인 결과와 조치 |
| --- | --- |
| CVE-2026-4738 | 기존 4개 이미지에서 MEDIUM 4행, 고유 CVE 1개. 실제 대상은 contrib/infback9이며 설치된 OS libz에는 해당 구현·패키지·export가 없어 그 공격 경로를 확인하지 못했다. 검출을 숨기지 않고 zlib 1.4-r0로 갱신했다. |
| zlib 1.4 추가 보안 수정 | upstream은 일반 libz의 버퍼·경계 처리 수정도 발표했다. 동일한 1.4 갱신에 포함된다. 이전 Alpine 1.3.2-r1에는 CVE-2026-85091 backport가 이미 있어 미패치로 중복 계산하지 않았다. |
| 소스와 운영 이미지 불일치 | 앞서 병합한 계정 보호 코드가 기존 실행 이미지에는 없었다. 이번 후보에는 해당 코드를 포함했고 핵심 서버 모듈 6개의 파일 hash를 소스와 대조했다. |
| Node.js 11월 보안 릴리스 | 11월 11일 이후 HIGH 수정 예정이라는 사전 공지다. 검사 시점에는 CVE·조건·고정 버전이 공개되지 않아 **미해결 대기**로 남긴다. 공개 후 실제 영향과 수정 버전을 제시하고 후속 승인을 받아야 한다. |

Next.js 16.4.5는 10월 14일 RCE 및 11월 3일 공지의 수정 버전이다. Nodemailer 10.3.1, Postfix 3.11.7, Dovecot 2.4.5, Nginx 1.30.6의 공지도 대조했다. 알려지지 않은 제로데이가 없다는 보증은 하지 않는다.

## 후보 이미지와 검사

Trivy 0.76.1, vulnerability DB UpdatedAt `2026-11-08T18:58:44.715199225Z`, 다운로드 `2026-11-08T20:24:39.74629175Z`. image archive의 config digest와 scanner metadata를 연결했고 별도 ignore·severity 필터·ignore-unfixed를 사용하지 않았다. OS는 Alpine 3.24.4이며 zlib 1.4-r0를 설치했다. runtime OS와 탐지 가능한 언어 패키지가 검사 대상이며 아래 0은 **당시 DB에 등록된 검출 결과**다. 미공개 Node 수정까지 해결됐다는 뜻이 아니다.

| 모듈 | Docker image ID | 전 중요도 검출 |
| --- | --- | --- |
| smtp | `sha256:ae6321ebd5f670a5f6b3d7d76ed80246b0f3a39c04bd0ca70937f12f63562390` | 0 |
| imap | `sha256:e1f102b5ecc5a5bb5ef1b6342569b3652bc8e230c15aff755fa8c52646ef6c36` | 0 |
| proxy | `sha256:8fbebeccfd2d227613519d88b9e294e76cfac83144ad97af680f2dc8721d67db` | 0 |
| webmail | `sha256:33ee7e0bba4114eddde1e6d554d426620cc7dbe9832321c09be44ff8c4ff3e17` | 0 |

로컬 증거는 ignored `.agents/security-rollout-2026-11-09/reports/`에 보관한다. 원시 scanner JSON, DB metadata, config/image ID 매핑, 모듈 hash, 계정 호환성 요약과 통합 시험 결과를 포함한다. 앞선 조사 증거는 `.agents/security-news-2026-11-08/reports/`에 있다. 실제 계정 hash·비밀번호·메일 원문을 이 문서나 PR에 첨부하지 않는다.

## 검증 결과

- Webmail 단위 테스트 33개 통과. 신규 Argon2id 무작위 salt, 긴 ASCII·한글 비밀번호의 마지막 글자 검증, 기존 bcrypt 호환, 잘못된 길이·NUL·비용 profile 거부 및 기존 계정 복구 시험을 포함한다.
- 네 이미지 빌드와 Webmail production Next.js build 통과. 기존 mailStore 파일 추적 경고 4건은 남지만 빌드는 성공했다. 개발·운영 Compose 설정 검사 통과.
- 운영 volume과 분리한 fixture에서 비밀번호 검증 29항목 통과: 8자·ASCII 128자·한글 128자의 가입, Webmail 로그인과 인증서·호스트를 검증한 IMAP STARTTLS 로그인, 다른 마지막 글자 거부, 기존 bcrypt Webmail/IMAP 로그인 및 hash 불변. 계정 파일 반영 직후의 재조회 간격을 고려해 IMAP 검증 전에 짧게 대기했다.
- SMTP 22항목 통과: 공개 수신의 STARTTLS/로컬 수신 허용, AUTH 비공개, 같은 사설망 외부 중계 거부, 제출 전 TLS 필수, 익명·오인증·일반 사용자 중계 거부, 전용 서비스 계정의 TLS/AUTH 제출 허용. 외부 수신자 검사는 RCPT 후 RSET/QUIT했고 실제 DATA는 fixture 내부로만 보냈다.
- IMAP 평문 로그인 거부와 재기동 전후 UIDVALIDITY·UID·Seen·메일 수 보존 확인. HTTPS redirect의 URI/query 보존, 인증서·호스트 불일치 거부, 로그인과 받은메일 화면, Secure/HttpOnly/SameSite cookie 확인.

## 운영 적용과 복구 조건

독립 current-head 리뷰와 필수 check를 통과한 뒤 develop/main에 반영한다. 운영 적용 직전 MailBox만 정지해 5개 volume의 일관된 백업을 mode 0600으로 만들고 기존 image ID를 rollback tag로 보존한다. 계정 행 hash·메일 본문 hash·UIDVALIDITY·큐 파일을 대조하고, 위에서 검사한 image ID로만 재기동한다. 실제 운영 적용 결과는 ignored 배포 기록으로 남긴다.

실패하면 기존 이미지와 보존한 volume 상태를 우선 확인한다. 신규 Argon2id 계정 생성 후 이전 Webmail로 되돌리면 그 신규 계정의 웹 로그인이 지원되지 않으므로 가입을 중단하고 호환 이미지와 백업을 함께 사용한다. 기존 계정 hash는 배포·로그인 때문에 변경하지 않는다. root 역할·capability·중계 신뢰 범위·TLS 검증을 완화하지 않는다. 자세한 운영 정책은 [운영 안내](operation.md)를 따른다.

## 공식 근거

- [zlib 1.4 릴리스와 보안 수정](https://zlib.net/)
- [Alpine 3.24 zlib 빌드와 secfixes](https://raw.githubusercontent.com/alpinelinux/aports/3.24-stable/main/zlib/APKBUILD)
- [Node.js 2026년 11월 보안 릴리스 사전 공지](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)
- [Node.js 24 crypto.argon2 API](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback)
- [Dovecot 비밀번호 hash 형식](https://doc.dovecot.org/2.4.1/core/config/auth/schemes.html)
- [Next.js 보안 공지](https://github.com/vercel/next.js/security/advisories)
- [Nodemailer 보안 공지](https://github.com/nodemailer/nodemailer/security/advisories)
