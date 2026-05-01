# Mail Server

이 패키지는 컨테이너 이미지 pull 방식으로 납품되는 메일 서버 솔루션이다.

## 구성

- `mail-server`: SMTP 수신, IMAP, Webmail 컨테이너 실행 파일
- `VERSION`: 릴리즈 버전
- `images.lock`: 납품 이미지 추적 정보
- `docs`: 설치, 운영, 장애 대응, 사용자 매뉴얼
- `checks`: 설치 전후 점검 스크립트
- `mail-tools`: 메일 데이터 백업/복구 및 수신 주소 관리 스크립트

## 설치 순서

1. `docs/설치가이드.md`를 읽고 서버와 DNS를 준비한다.
2. 필요하면 registry에 로그인한다.
3. `mail-server.env.example`을 `mail-server.env`로 복사해 값을 수정한다.
4. `mail-server/compose.sh pull` 후 `mail-server/compose.sh up -d`를 실행한다.
5. `checks/healthcheck.sh`로 상태를 확인한다.

소스 코드는 납품 패키지에 포함하지 않는다.
