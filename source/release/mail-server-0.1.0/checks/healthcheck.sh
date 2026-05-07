#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="${MAIL_ENV_FILE:-$PACKAGE_DIR/mail-server.env}"

if [ ! -f "$ENV_FILE" ]; then
  printf 'env file not found: %s\n' "$ENV_FILE" >&2
  exit 1
fi

load_env_file() {
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
      *=*) ;;
      *) continue ;;
    esac
    key=${line%%=*}
    value=${line#*=}
    case "$key" in
      [A-Za-z_]*[A-Za-z0-9_]|[A-Za-z_])
        printf -v "$key" '%s' "$value"
        export "$key"
        ;;
    esac
  done < "$1"
}

load_env_file "$ENV_FILE"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$PACKAGE_DIR/mail-server/docker-compose.yml" "$@"
}

compose ps

for service in mail-smtp-receiver mail-imap-mailbox mail-webmail-ui; do
  status=$(docker inspect "$service" --format '{{.State.Status}}' 2>/dev/null || true)
  if [ "$status" != "running" ]; then
    printf 'FAIL: %s is %s\n' "$service" "${status:-missing}" >&2
    exit 1
  fi
  printf 'OK: %s running\n' "$service"
done

if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1:${MAIL_WEB_PORT:-18080}" >/dev/null
  printf 'OK: webmail responds on port %s\n' "${MAIL_WEB_PORT:-18080}"
fi
