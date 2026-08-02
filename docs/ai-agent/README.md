# MailBox AI Agent Guide

문서 최신화 기준일: 2026-08-02

이 영역에는 AI agent가 구현·검토·문서 수정을 수행하기 전에 확인해야 하는 규칙만 둔다. 프로젝트 배경과 사람 중심 설명은 `docs/developer`에 둔다.

## Required Reading

1. [Development Rules](./development-rules.md)
2. [Architecture Contract](./architecture-contract.md)
3. [Developer Onboarding](../developer/onboarding/mailbox-onboarding.md)
4. [System Architecture](../developer/architecture/system-architecture.md)

## Task-Specific Reading

- SMTP 수신 또는 주소 변경: [System Architecture](../developer/architecture/system-architecture.md), [Operation](../developer/guides/operation.md)
- IMAP 또는 Maildir 변경: [System Architecture](../developer/architecture/system-architecture.md), [Troubleshooting](../developer/guides/troubleshooting.md)
- Webmail 인증·메일함·발송 변경: [Architecture Contract](./architecture-contract.md), [User Guide](../developer/guides/user-guide.md)
- Compose·환경변수·volume 변경: [Installation](../developer/guides/installation.md), [Operation](../developer/guides/operation.md)

## Non-Negotiable Rule

기존 구현과 사용자 diff를 먼저 확인한다. 변경한 모듈의 빌드·테스트와 관련 문서 링크를 검증하고, 메일 본문·비밀번호·세션 secret·가입 코드·토큰을 코드, 로그, 문서 예시에 기록하지 않는다.
