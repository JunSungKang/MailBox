#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="${MAIL_ENV_FILE:-$PACKAGE_DIR/mail-server.env}"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

ok() {
  printf 'OK: %s\n' "$1"
}

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

command -v docker >/dev/null 2>&1 || fail "docker command not found"
docker compose version >/dev/null 2>&1 || fail "docker compose plugin not found"
ok "docker compose available"

if [ ! -f "$ENV_FILE" ]; then
  fail "env file not found: $ENV_FILE"
fi
ok "env file exists: $ENV_FILE"

load_env_file "$ENV_FILE"

for key in MAIL_SMTP_RECEIVER_IMAGE MAIL_IMAP_MAILBOX_IMAGE MAIL_WEBMAIL_UI_IMAGE MAIL_HOSTNAME MAIL_DOMAINS; do
  value="${!key:-}"
  [ -n "$value" ] || fail "$key is required"
done
ok "required environment values are set"

for port in "${SMTP_PORT:-25}" "${IMAP_PORT:-143}" "${MAIL_WEB_PORT:-18080}"; do
  case "$port" in
    ''|*[!0-9]*) fail "invalid port: $port" ;;
  esac
done
ok "ports are numeric"

docker compose --env-file "$ENV_FILE" -f "$PACKAGE_DIR/mail-server/docker-compose.yml" config >/dev/null
ok "compose config is valid"
