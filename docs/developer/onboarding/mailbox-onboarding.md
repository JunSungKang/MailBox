# MailBox Onboarding

문서 최신화 기준일: 2026-11-04

## Project Summary

이 프로젝트는 세 핵심 모듈로 동작하는 단일 노드 메일 서버다. Postfix가 SMTP 메일을 Maildir에 배달하고, Dovecot과 Next.js Webmail이 같은 메일 데이터를 각자의 인터페이스로 제공한다. 운영 실행은 Nginx HTTPS 프록시를 더해 네 컨테이너를 사용한다.

## Stack

- SMTP: Ubuntu 26.04 Postfix (배포판 보안 backport 적용) (Node.js는 비권한 계정 맵 감시기만 실행)
- IMAP: Dovecot 2.4 on Ubuntu 26.04 (Maildir 저장 형식은 2.3 호환 유지)
- Webmail: Node.js 24, Next.js 16, React 19, TypeScript 6
- Mail parsing/sending: `mailparser`, `nodemailer`, `busboy`
- 운영 Webmail HTTPS: Nginx
- Runtime composition: Docker Compose (`platform`, `compose.platform.yaml`), Docker Bake

## Directory Ownership

- `smtp-receiver`: `main.cf`, 수신 주소 map, container entrypoint.
- `imap-mailbox`: `dovecot.conf`, IMAP users, container entrypoint.
- `webmail-ui`: App Router 화면, custom Node server, 메일 파일 저장소와 인증.
- `docker-compose.yml`: 소스 build 기반 개발 실행.
- `compose.platform.yaml`: Ubuntu 네 서비스 통합 운영.
- `docker-bake.hcl`: 공통 Node24 기반과 네 이미지 빌드.
- `docker-compose.prod.yml`: 이전 실행 구성과 복구 참고.
- `docs/ai-agent`: agent 작업 규칙.
- `docs/developer`: 개발자 온보딩과 운영 지식.

## Commands

```bash
# 새 설치에서만 .env.example로 환경 파일을 준비한다. 기존 .env는 보존한다.
# 설치 안내에 따라 보안 값과 MAIL_TLS_DIR의 인증서를 준비한다.
docker buildx bake
docker compose --env-file .env -f compose.platform.yaml config --quiet
docker compose ps
npm test --prefix webmail-ui
npm run build --prefix webmail-ui
```

실제 교체는 공유 잠금·백업·복구 gate를 포함한 [전환 절차](../guides/ubuntu-platform-transition.md)를 따른다. 인증서·네트워크 준비와 운영 HTTPS 실행은 [설치 안내](../guides/installation.md)를 따른다. 화면은 밝은 미래 우편함인 “내일의 우편함” 테마를 사용한다.

## Webmail Entry Points

- `webmail-ui/server.mjs`: HTTP server, login/signup/logout, multipart send, attachment download.
- `webmail-ui/auth-core.mjs`: HMAC session 생성·검증의 공용 구현.
- `webmail-ui/src/app`: inbox, sent, bounced, compose, login, signup, detail UI.
- `webmail-ui/src/lib/mailStore.ts`: Maildir import와 Webmail 파일 저장소.
- `webmail-ui/src/lib/mailAccess.ts`: 사용자별 메시지 소유권 판정.
- `webmail-ui/src/lib/auditLogger.ts`: 구조화 감사 로그.

구조와 데이터 흐름의 상세 내용은 [System Architecture](../architecture/system-architecture.md)를 기준으로 확인한다.

통합 빌드와 전환은 [Ubuntu platform 전환](../guides/ubuntu-platform-transition.md)을 따른다.
