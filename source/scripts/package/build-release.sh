#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
VERSION="${VERSION:-1.0.0}"
case "$VERSION" in
  v*) IMAGE_VERSION="$VERSION" ;;
  *) IMAGE_VERSION="v$VERSION" ;;
esac

RELEASE_ROOT="${RELEASE_ROOT:-$SOURCE_ROOT/release}"
PACKAGE_NAME="${PACKAGE_NAME:-mail-server-$VERSION}"
PACKAGE_DIR="$RELEASE_ROOT/$PACKAGE_NAME"
IMAGES_LOCK="${IMAGES_LOCK:-$SOURCE_ROOT/release/images.lock}"

REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-junsungkang}"
IMAGE_NAME_PREFIX="${IMAGE_NAME_PREFIX:-mail-server-}"
SMTP_IMAGE="${SMTP_IMAGE:-$REGISTRY/$IMAGE_NAMESPACE/${IMAGE_NAME_PREFIX}smtp-receiver:$IMAGE_VERSION}"
IMAP_IMAGE="${IMAP_IMAGE:-$REGISTRY/$IMAGE_NAMESPACE/${IMAGE_NAME_PREFIX}imap-mailbox:$IMAGE_VERSION}"
WEBMAIL_IMAGE="${WEBMAIL_IMAGE:-$REGISTRY/$IMAGE_NAMESPACE/${IMAGE_NAME_PREFIX}webmail-ui:$IMAGE_VERSION}"

require_file() {
  if [ ! -f "$1" ]; then
    printf 'missing required file: %s\n' "$1" >&2
    exit 1
  fi
}

prepare_package_dir() {
  rm -rf "$PACKAGE_DIR"
  mkdir -p "$PACKAGE_DIR/mail-server" "$PACKAGE_DIR/docs" "$PACKAGE_DIR/checks" "$PACKAGE_DIR/mail-tools"
}

write_root_readme() {
  cat > "$PACKAGE_DIR/README.md" <<'README'
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
README
}

write_env_example() {
  cat > "$PACKAGE_DIR/mail-server.env.example" <<EOF
MAIL_SMTP_RECEIVER_IMAGE=$SMTP_IMAGE
MAIL_IMAP_MAILBOX_IMAGE=$IMAP_IMAGE
MAIL_WEBMAIL_UI_IMAGE=$WEBMAIL_IMAGE

MAIL_HOSTNAME=mail.ds-mail.p-e.kr
MAIL_DOMAINS=ds-mail.p-e.kr post.ds-mail.p-e.kr
MAIL_FROM=mailbox@ds-mail.p-e.kr
MAIL_DEFAULT_DOMAIN=ds-mail.p-e.kr

SMTP_PORT=25
IMAP_PORT=143
MAIL_WEB_PORT=18080

MYNETWORKS=127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16

MAILBOX_VOLUME=mailbox-store
SMTP_QUEUE_VOLUME=smtp-queue-store
WEBMAIL_DATA_VOLUME=webmail-data-store
MAIL_BACKUP_DIR=/srv/mail-server/backups
EOF
}

write_images_lock() {
  if [ -f "$IMAGES_LOCK" ]; then
    cp "$IMAGES_LOCK" "$PACKAGE_DIR/images.lock"
  else
    {
      printf 'smtp-receiver=%s\n' "$SMTP_IMAGE"
      printf 'imap-mailbox=%s\n' "$IMAP_IMAGE"
      printf 'webmail-ui=%s\n' "$WEBMAIL_IMAGE"
    } > "$PACKAGE_DIR/images.lock"
  fi
}

write_compose_wrapper() {
  cat > "$PACKAGE_DIR/mail-server/compose.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE="${MAIL_ENV_FILE:-$PACKAGE_DIR/mail-server.env}"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$PACKAGE_DIR/mail-server.env.example" ]; then
    cp "$PACKAGE_DIR/mail-server.env.example" "$ENV_FILE"
  fi
  printf 'created %s\n' "$ENV_FILE" >&2
  printf 'edit %s, then run this command again\n' "$ENV_FILE" >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/docker-compose.yml" "$@"
SCRIPT
  chmod +x "$PACKAGE_DIR/mail-server/compose.sh"
}

copy_delivery_files() {
  cp "$SOURCE_ROOT/deploy/single-node/docker-compose.yml" "$PACKAGE_DIR/mail-server/docker-compose.yml"
  cp "$SOURCE_ROOT/deploy/templates/mail-server.env.example" "$PACKAGE_DIR/mail-server/.env.example"

  cp "$SOURCE_ROOT/docs/install/설치가이드.md" "$PACKAGE_DIR/docs/설치가이드.md"
  cp "$SOURCE_ROOT/docs/operation/운영가이드.md" "$PACKAGE_DIR/docs/운영가이드.md"
  cp "$SOURCE_ROOT/docs/operation/장애대응가이드.md" "$PACKAGE_DIR/docs/장애대응가이드.md"
  cp "$SOURCE_ROOT/docs/operation/백업복구가이드.md" "$PACKAGE_DIR/docs/백업복구가이드.md"
  cp "$SOURCE_ROOT/docs/user-manual/사용자매뉴얼.md" "$PACKAGE_DIR/docs/사용자매뉴얼.md"

  cp "$SOURCE_ROOT/scripts/verify/preflight.sh" "$PACKAGE_DIR/checks/preflight.sh"
  cp "$SOURCE_ROOT/scripts/verify/healthcheck.sh" "$PACKAGE_DIR/checks/healthcheck.sh"
  cp "$SOURCE_ROOT/scripts/verify/mail-user-add.sh" "$PACKAGE_DIR/mail-tools/mail-user-add.sh"
  cp "$SOURCE_ROOT/scripts/backup/mail-backup.sh" "$PACKAGE_DIR/mail-tools/mail-backup.sh"
  cp "$SOURCE_ROOT/scripts/backup/mail-restore.sh" "$PACKAGE_DIR/mail-tools/mail-restore.sh"
  chmod +x "$PACKAGE_DIR/checks/preflight.sh" "$PACKAGE_DIR/checks/healthcheck.sh" "$PACKAGE_DIR/mail-tools/"*.sh
}

main() {
  require_file "$SOURCE_ROOT/deploy/single-node/docker-compose.yml"
  require_file "$SOURCE_ROOT/deploy/templates/mail-server.env.example"
  prepare_package_dir
  copy_delivery_files
  printf '%s\n' "$VERSION" > "$PACKAGE_DIR/VERSION"
  write_images_lock
  write_env_example
  write_compose_wrapper
  write_root_readme
  printf '%s\n' "$PACKAGE_DIR"
}

main "$@"
