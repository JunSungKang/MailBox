# MailBox 설치

## 준비

- Linux 서버에 Docker Engine과 Docker Compose plugin을 설치한다.
- DNS `MX`가 서버의 공인 IP 또는 메일 호스트명을 가리키게 설정한다.
- TCP `25`, `143`, `18080` 포트를 방화벽에서 허용한다.
- 운영 발신까지 사용할 경우 `SPF`, `DKIM`, `DMARC`, `PTR/rDNS`를 별도로 준비한다.

저장소 루트에서 환경 파일을 준비한다.

```bash
cp .env.example .env
```

운영 전 `WEBMAIL_SESSION_SECRET`을 32자 이상의 무작위 값으로, `WEBMAIL_SIGNUP_TOKEN`을 운영자만 아는 16자 이상의 가입 코드로 교체한다. placeholder 값으로는 운영 Webmail이 시작되지 않는다. 세션 secret이 바뀌면 기존 로그인 세션은 만료된다. HTTPS reverse proxy 뒤에서 운영할 때는 `WEBMAIL_COOKIE_SECURE=true`로 설정한다.

개발 또는 소스 검증 환경에서는 세 이미지를 직접 빌드해 실행한다.

```bash
docker compose up -d --build
```

운영 환경에서는 `.env`의 이미지 주소를 확인하고 registry 인증 후 운영 Compose를 실행한다.

```bash
docker login ghcr.io
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 점검

`docker compose ps`에서 세 컨테이너가 실행 중인지 확인하고 `curl -f http://localhost:18080`으로 Webmail 응답을 확인한다.

웹메일은 기본값 기준 `http://<server>:18080`에서 확인한다.
