# MailBox Developer Guide

문서 최신화 기준일: 2026-08-02

이 영역은 사람이 프로젝트 구조와 실행 흐름을 이해하기 위한 문서다. AI agent 전용 완료 조건은 `docs/ai-agent`에 둔다.

## Recommended Reading Order

1. [MailBox Onboarding](./onboarding/mailbox-onboarding.md)
2. [System Architecture](./architecture/system-architecture.md)
3. [Installation](./guides/installation.md)
4. [Operation](./guides/operation.md)
5. [Troubleshooting](./guides/troubleshooting.md)
6. [User Guide](./guides/user-guide.md)

## Developer Checklist

- 변경할 책임이 SMTP, IMAP, Webmail, Compose 중 어디에 속하는지 먼저 구분한다.
- Webmail 변경 전 `webmail-ui/package.json`, `server.mjs`, 관련 `src/app`과 `src/lib`를 함께 확인한다.
- volume이나 환경변수를 바꾸면 개발·운영 Compose와 문서를 같이 갱신한다.
- 커밋 전 Webmail test/build와 변경된 Compose 또는 문서 검증을 실행한다.
