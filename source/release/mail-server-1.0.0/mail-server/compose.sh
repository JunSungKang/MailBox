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
