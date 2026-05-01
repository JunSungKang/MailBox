# Mail Server Packaging

이 저장소는 CRM 프로젝트와 같은 납품 패키징 구조를 사용한다.

## 구조

```text
source/
├── apps/       # 컨테이너 이미지 빌드 소스
├── deploy/     # 로컬 검증 및 납품 compose/env 템플릿
├── docs/       # 설치, 운영, 장애 대응, 사용자 문서
├── scripts/    # 이미지, 패키징, 점검, 백업 스크립트
└── release/    # 생성된 납품 패키지
```

## 로컬 실행

```bash
cd source/deploy/local
cp ../templates/local.env.example .env
docker compose --env-file .env up -d --build
```

## 릴리즈 패키지 생성

```bash
cd source
scripts/package/build-release.sh
```

생성 결과는 `source/release/mail-server-<version>/`에 만들어진다.
