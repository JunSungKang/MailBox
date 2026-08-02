# MailBox

`MailBox`는 Postfix SMTP 수신기, Dovecot IMAP 메일함, Next.js Webmail을 Docker Compose로 연결한 메일 서버 프로젝트다. 각 실행 모듈을 저장소 최상위에서 바로 찾고 독립적으로 빌드할 수 있다.

표시 이름은 `MailBox`, package·image·container 같은 기계 식별자는 `mailbox`, 로컬 checkout 디렉터리는 `mail-box`를 사용한다.

## 구조

```text
smtp-receiver/         # SMTP 수신과 Maildir 배달
imap-mailbox/          # Maildir을 제공하는 IMAP 서버
webmail-ui/            # 메일 조회, 작성, 사용자 화면
docs/                  # 아키텍처와 설치·운영 문서
docker-compose.yml     # 소스 빌드 기반 개발 실행
docker-compose.prod.yml # 이미지 pull 기반 운영 실행
.env.example           # 공통 환경변수 예시
```

패키징용 중간 디렉터리나 생성된 릴리즈는 저장소에서 관리하지 않는다. 각 서비스의 Dockerfile과 루트 Compose 파일이 빌드 및 실행의 기준이다.

## 빠른 시작

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

기본 접속 지점은 Webmail `http://localhost:18080`, SMTP `localhost:25`, IMAP `localhost:143`이다.

중지할 때 `docker compose down`은 데이터를 보존한다. `docker compose down -v`는 메일을 포함한 named volume을 삭제하므로 복구가 필요 없는 경우에만 사용한다.

## 운영 실행

`.env`의 운영 값을 확인한 뒤 로그 회전과 운영 volume 이름을 적용하는 Compose 파일로 이미지를 빌드해 실행한다.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 문서

- [문서 안내](docs/README.md)
- [AI Agent 작업 지침](docs/ai-agent/README.md)
- [개발자 온보딩](docs/developer/README.md)
- [시스템 아키텍처](docs/developer/architecture/system-architecture.md)
- [설치](docs/developer/guides/installation.md)
- [운영](docs/developer/guides/operation.md)
- [장애 대응](docs/developer/guides/troubleshooting.md)
- [사용자 안내](docs/developer/guides/user-guide.md)

## 라이선스

MailBox는 [Apache License 2.0](LICENSE)에 따라 배포된다. SPDX 식별자는 `Apache-2.0`이다.
