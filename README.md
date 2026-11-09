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
docker-compose.prod.yml # 이전 운영 구성과 복구 참고
compose.platform.yaml  # Ubuntu 통합 운영 (project: platform)
docker-bake.hcl        # Ubuntu Node24 공통 기반과 네 이미지 빌드
.env.example           # 공통 환경변수 예시
```

패키징용 중간 디렉터리나 생성된 릴리즈는 저장소에서 관리하지 않는다. 각 서비스의 Dockerfile과 루트 Compose 파일이 빌드 및 실행의 기준이다.

## 빌드와 운영

새 설치에서만 `.env.example`을 `.env`로 복사하고 보안 값과 인증서를 준비한다. 기존 `.env`와 데이터는 덮어쓰지 않는다. Ubuntu26.04/Node24 이미지의 빌드와 설정 확인은 다음과 같다.

```bash
docker buildx bake
docker compose --env-file .env -f compose.platform.yaml config --quiet
```

실제 교체는 [잠금·백업·검증·복구 절차](docs/developer/guides/ubuntu-platform-transition.md)를 따른다. 다섯 기존 external volume과 공유 네트워크가 필요하다. 기존 운영 환경에서 준비 없이 `up --build`로 교체하지 않는다.

운영 Webmail은 `https://<MAIL_WEB_HOSTNAME>:20006`이며 HTTP `20005`는 HTTPS로 이동한다. 이전 `18080`/`18443` 경로도 전환 기간 유지한다. API는 같은 HTTPS의 `/api/`로 제공하고 `127.0.0.1:20105`는 로컬 진단에만 사용한다. SMTP `25`와 IMAP `143`은 STARTTLS를 제공하며 앱 제출은 내부 `587`에서 TLS와 서비스 인증을 요구한다. 이전 내부 `2525`/`2587`도 유지한다.

인증서·개인키·계정 데이터·`.env`는 커밋하지 않는다. 메일 볼륨 삭제와 다른 platform 서비스의 중지를 피하고, 서비스 조작은 네 `mailbox-*` 이름을 명시한다.

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

## Ubuntu 통합 운영

Ubuntu26.04 네 서비스는 `docker buildx bake`로 빌드하고 `docker compose -f compose.platform.yaml`로 관리한다. 기존 설치의 실제 교체는 공유 파일 잠금과 데이터 백업이 필요하다. [전환·보안·복구 안내](docs/developer/guides/ubuntu-platform-transition.md)를 먼저 따른다.
