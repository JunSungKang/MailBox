# Contributing to MailBox

버그 수정, 테스트, 문서, 기능 제안을 환영합니다. 프로젝트 라이선스는 [AGPL-3.0-only](LICENSE)입니다. 자신의 변경을 기여할 권리가 있는 코드만 제출하고 외부 코드의 라이선스·출처 고지를 보존해 주세요.

## Before a change

1. 기존 Issue와 [아키텍처](docs/developer/architecture/system-architecture.md)를 확인합니다.
2. [AGENTS.md](AGENTS.md)와 [개발 규칙](docs/ai-agent/development-rules.md)을 읽습니다.
3. feature branch에서 관련 모듈만 수정하고 기존 사용자 변경과 운영 파일을 보존합니다.

## Validation

웹메일 변경은 Node24에서 `npm ci`, `npm test`, `npm run build`를 실행합니다. 이미지·설정 변경은 Bake·Compose 해석과 관련 격리 fixture를 확인합니다. [게시 문서](docs/developer/guides/container-packages.md)에 검증 명령과 release 경로가 있습니다.

테스트는 별도 계정·Maildir·큐·볼륨·네트워크를 사용하고 메일은 로컬 fixture에만 보냅니다. 실제 메일·비밀번호·토큰·개인키·runtime 자료는 소스나 검증 첨부에 넣지 않습니다. 기능 로그는 기존 JSON Lines 스키마를 따르고 비밀값과 본문을 제외합니다.

## Pull requests

PR에는 해결하는 문제, 최종 동작, 관련 Issue, 테스트 결과와 데이터·호환성 영향을 적습니다. 문서의 링크와 설정 예시도 확인하고 실행하지 못한 검증은 명시해 주세요.

통합 branch는 `develop`, 릴리스 branch는 `main`입니다. 사람 작성 PR과 현재 head의 독립 GitHub App 리뷰·필수 검사를 거쳐 병합합니다. 병합된 feature branch는 원격과 로컬에서 정리합니다. 외부 기여자는 자신의 fork에 작업하며 maintainer가 저장소의 guarded 통합·릴리스 절차를 수행합니다.
