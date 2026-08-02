# MailBox Documentation

문서 최신화 기준일: 2026-08-02

이 디렉터리는 독자와 목적에 따라 두 영역으로 나뉜다. 새 문서를 추가할 때는 아래 영역 중 하나에 배치하고 이 인덱스를 함께 갱신한다.

## AI Agent

- [AI Agent Guide](./ai-agent/README.md): 에이전트가 변경 전에 읽어야 할 문서와 작업별 경로.
- [Development Rules](./ai-agent/development-rules.md): 변경 범위, 보안, 로그, 검증 불변 규칙.
- [Architecture Contract](./ai-agent/architecture-contract.md): 모듈 소유권과 허용 의존 방향.

## Developer

- [Developer Guide](./developer/README.md): 사람 개발자를 위한 권장 읽기 순서.
- [MailBox Onboarding](./developer/onboarding/mailbox-onboarding.md): 기술 스택, 실행 방법, 주요 코드 진입점.
- [System Architecture](./developer/architecture/system-architecture.md): 컨테이너, 데이터, 인증, 메일 처리 흐름.
- [Installation](./developer/guides/installation.md): 개발 및 운영 설치.
- [Operation](./developer/guides/operation.md): 로그, 재시작, 이미지 교체, 주소 관리.
- [Troubleshooting](./developer/guides/troubleshooting.md): 기동, 수신, Webmail 문제 진단.
- [User Guide](./developer/guides/user-guide.md): Webmail 사용과 IMAP 접속.

## Update Rules

- 작업 절차나 완료 조건이 바뀌면 `docs/ai-agent`를 갱신한다.
- 모듈 경계, 런타임 흐름, 주요 코드 진입점이 바뀌면 `docs/developer`를 갱신한다.
- Compose 환경변수나 volume이 바뀌면 시스템 아키텍처와 설치·운영 문서를 함께 검토한다.
- 인증, 메일함, 발송 동작이 바뀌면 사용자 안내와 장애 대응 문서를 함께 검토한다.
