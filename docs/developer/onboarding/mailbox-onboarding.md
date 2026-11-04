# MailBox Onboarding

문서 최신화 기준일: 2026-11-04

## Project Summary

이 프로젝트는 세 핵심 모듈로 동작하는 단일 노드 메일 서버다. Postfix가 SMTP 메일을 Maildir에 배달하고, Dovecot과 Next.js Webmail이 같은 메일 데이터를 각자의 인터페이스로 제공한다. 운영 실행은 Nginx HTTPS 프록시를 더해 네 컨테이너를 사용한다.

## Stack

- SMTP: Postfix 3.11 on Alpine stable (Node.js는 비권한 계정 맵 감시기만 실행)
- IMAP: Dovecot 2.4 on Alpine stable (Maildir 저장 형식은 2.3 호환 유지)
- Webmail: Node.js 24, Next.js 16, React 19, TypeScript 6
- Mail parsing/sending: `mailparser`, `nodemailer`, `busboy`
- 운영 Webmail HTTPS: Nginx
- Runtime composition: Docker Compose

## Directory Ownership

- `smtp-receiver`: `main.cf`, 수신 주소 map, container entrypoint.
- `imap-mailbox`: `dovecot.conf`, IMAP users, container entrypoint.
- `webmail-ui`: App Router 화면, custom Node server, 메일 파일 저장소와 인증.
- `docker-compose.yml`: 소스 build 기반 개발 실행.
- `docker-compose.prod.yml`: 세 모듈 이미지와 HTTPS 프록시를 사용하는 운영 실행.
- `docs/ai-agent`: agent 작업 규칙.
- `docs/developer`: 개발자 온보딩과 운영 지식.

## Commands

```bash
cp .env.example .env
# 설치 안내에 따라 보안 값과 MAIL_TLS_DIR의 인증서를 준비한다.
docker compose up -d --build
docker compose ps
npm test --prefix webmail-ui
npm run build --prefix webmail-ui
```

인증서·네트워크 준비와 운영 HTTPS 실행은 [설치 안내](../guides/installation.md)를 따른다. 화면은 밝은 미래 우편함인 “내일의 우편함” 테마를 사용한다.

## Webmail Entry Points

- `webmail-ui/server.mjs`: HTTP server, login/signup/logout, multipart send, attachment download.
- `webmail-ui/auth-core.mjs`: HMAC session 생성·검증의 공용 구현.
- `webmail-ui/src/app`: inbox, sent, bounced, compose, login, signup, detail UI.
- `webmail-ui/src/lib/mailStore.ts`: Maildir import와 Webmail 파일 저장소.
- `webmail-ui/src/lib/mailAccess.ts`: 사용자별 메시지 소유권 판정.
- `webmail-ui/src/lib/auditLogger.ts`: 구조화 감사 로그.

구조와 데이터 흐름의 상세 내용은 [System Architecture](../architecture/system-architecture.md)를 기준으로 확인한다.
