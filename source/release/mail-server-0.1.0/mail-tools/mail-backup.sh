#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="${MAIL_ENV_FILE:-$PACKAGE_DIR/mail-server.env}"

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

[ -f "$ENV_FILE" ] && load_env_file "$ENV_FILE"

BACKUP_DIR="${MAIL_BACKUP_DIR:-$PACKAGE_DIR/backups}"
STAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE="$BACKUP_DIR/mail-server-$STAMP.tar.gz"

mkdir -p "$BACKUP_DIR"
docker run --rm \
  -v "${MAILBOX_VOLUME:-mailbox-store}:/backup/mailbox:ro" \
  -v "${SMTP_QUEUE_VOLUME:-smtp-queue-store}:/backup/postfix-spool:ro" \
  -v "${WEBMAIL_DATA_VOLUME:-webmail-data-store}:/backup/webmail-data:ro" \
  -v "$BACKUP_DIR:/out" \
  alpine:3.20 \
  tar -czf "/out/$(basename "$ARCHIVE")" -C /backup .

printf '%s\n' "$ARCHIVE"
