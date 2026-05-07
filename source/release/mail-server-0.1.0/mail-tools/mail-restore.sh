#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  printf 'usage: %s <backup.tar.gz>\n' "$0" >&2
  exit 1
fi

ARCHIVE="$1"
[ -f "$ARCHIVE" ] || { printf 'backup not found: %s\n' "$ARCHIVE" >&2; exit 1; }

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

docker run --rm \
  -v "${MAILBOX_VOLUME:-mailbox-store}:/restore/mailbox" \
  -v "${SMTP_QUEUE_VOLUME:-smtp-queue-store}:/restore/postfix-spool" \
  -v "${WEBMAIL_DATA_VOLUME:-webmail-data-store}:/restore/webmail-data" \
  -v "$(CDPATH= cd -- "$(dirname -- "$ARCHIVE")" && pwd):/in:ro" \
  alpine:3.20 \
  sh -c 'cd /restore && tar -xzf "/in/$0"' "$(basename "$ARCHIVE")"

printf 'restored %s\n' "$ARCHIVE"
