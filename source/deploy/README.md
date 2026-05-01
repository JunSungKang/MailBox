# Deploy

## local

개발자 또는 내부 검증자가 소스에서 이미지를 빌드해 실행하는 구성이다.

```bash
cd source/deploy/local
cp ../templates/local.env.example .env
docker compose --env-file .env up -d --build
```

## single-node

고객사 납품 패키지에서 사용하는 이미지 pull 기반 구성이다.

```bash
cp mail-server.env.example mail-server.env
docker compose --env-file mail-server.env pull
docker compose --env-file mail-server.env up -d
```
