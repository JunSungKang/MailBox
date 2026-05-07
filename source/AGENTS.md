# AGENTS

이 프로젝트는 CRM 프로젝트와 동일한 패키징 원칙을 따른다.

- 소스는 `source/apps` 아래 서비스별로 둔다.
- 배포 compose와 env 템플릿은 `source/deploy` 아래에 둔다.
- 납품 문서는 `source/docs` 아래에 둔다.
- 릴리즈 패키지는 `source/scripts/package/build-release.sh`로 생성한다.
- 생성된 release 패키지에는 소스 코드를 포함하지 않는다.

## 운영 로그 원칙

- 기능을 추가하거나 변경할 때는 운영자가 누가, 언제, 어디서, 어떤 기능을 사용했고 성공 또는 실패했는지 추적할 수 있도록 로그를 함께 추가한다.
- 로그는 `INFO`, `WARN`, `ERROR` 레벨을 사용한다.
- 정상 사용자 행위와 운영 이벤트는 `INFO`, 비정상 요청이나 접근 실패는 `WARN`, 기능 실패와 예외는 `ERROR`로 기록한다.
- 로그는 사람이 작성한 문자열을 이어붙이지 말고 구조화 객체를 `JSON.stringify`로 직렬화한 JSON Lines 형식으로 남긴다.
- 모든 로그에는 가능한 범위에서 `time`, `level`, `event`, `requestId`, `actor`, `ip`, `userAgent`, `method`, `path`, `durationMs`, `status`를 포함한다.
- 이벤트명은 `mail.send.success`, `mail.detail.view`처럼 도메인과 동작을 점으로 구분해 일관되게 작성한다.
- 메일 본문, 첨부파일 내용, 비밀번호, 토큰, 쿠키, 전체 인증 헤더는 로그에 남기지 않는다.
- 수신자 전체 주소, 제목 등 개인정보가 될 수 있는 값은 필요한 경우에만 남기고, 기본은 개수, 도메인, ID, 해시 등 최소 정보로 기록한다.
- Webmail 서버 코드는 `src/lib/auditLogger.ts`의 스키마와 같은 형태로 감사 로그를 남긴다.
