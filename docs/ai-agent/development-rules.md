# MailBox Agent Development Rules

문서 최신화 기준일: 2026-11-15

## Required Pre-Work

1. `git status --short`, 현재 branch, canonical `origin`을 확인한다.
2. `docs/ai-agent/README.md`, `docs/ai-agent/architecture-contract.md`와 작업별 developer 문서를 읽는다.
3. `rg`로 변경 책임을 가진 기존 코드와 테스트를 찾는다.
4. 사용자 변경으로 보이는 기존 diff와 ignored 운영 파일을 삭제하거나 덮어쓰지 않는다.
5. GitHub tracked write는 저장소 governance와 로컬 ignored `sprint/` 계약을 사용한다.

## Implementation Rules

- 모듈별 Dockerfile과 설정은 해당 최상위 모듈이 소유한다.
- 서비스 간 네트워크, port, volume, 환경변수 조립은 루트 Compose가 소유한다.
- Webmail 화면은 `webmail-ui/src/app`, 저장·감사·접근 규칙은 `webmail-ui/src/lib`, HTTP multipart·인증 endpoint는 `webmail-ui/server.mjs`가 소유한다.
- 사용자별 목록, 상세, 첨부, 발송 경로에는 같은 서명 세션과 소유권 검사를 적용한다.
- 운영에서는 placeholder `WEBMAIL_SESSION_SECRET`으로 서버를 시작하지 않는다. 회원가입은 아이디와 비밀번호로 공개 제공하며 가입 코드를 요구하지 않는다. SMTP 서비스 ID와 기존 recipient ID 예약, 이전 계정 소유권 검증을 우회하지 않는다.

## Audit Log Rules

- `INFO`, `WARN`, `ERROR` JSON Lines를 사용한다.
- 가능한 경우 `time`, `level`, `event`, `requestId`, `actor`, `ip`, `userAgent`, `method`, `path`, `durationMs`, `status`를 포함한다.
- 이벤트명은 `mail.send.success`, `auth.login.invalid_credentials`처럼 도메인과 동작을 점으로 구분한다.
- 메일 본문, 첨부 내용, 비밀번호, cookie, session secret, 가입 코드, 인증 header 전체를 기록하지 않는다.

## Validation Requirements

문서만 변경해도 링크와 경로를 확인한다.

```bash
rg -n 'docs/' README.md AGENTS.md docs
git diff --check
```

Webmail 변경은 다음을 실행한다.

```bash
npm test --prefix webmail-ui
npm run build --prefix webmail-ui
```

Compose 변경은 Docker CLI가 있는 환경에서 다음을 실행한다.

```bash
docker compose --env-file .env.example config
docker compose --env-file .env.example -f docker-compose.prod.yml config
```

Docker CLI가 없으면 YAML 파싱, 세 서비스, 네 volume, build context 존재를 대체 검증하고 미실행 항목을 PR에 기록한다.

## Documentation Requirements

- 작업 규칙이나 불변 조건 변경: `docs/ai-agent` 갱신
- 모듈 책임이나 데이터 흐름 변경: developer onboarding과 architecture 갱신
- 운영 명령·환경변수 변경: developer installation과 operation 갱신
- 사용자 기능·제약 변경: developer user guide와 troubleshooting 갱신
