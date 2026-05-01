#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
. "$SCRIPT_DIR/env.sh"

docker build -t "$SMTP_IMAGE" "$SOURCE_ROOT/apps/smtp-receiver"
docker build -t "$IMAP_IMAGE" "$SOURCE_ROOT/apps/imap-mailbox"
docker build -t "$WEBMAIL_IMAGE" "$SOURCE_ROOT/apps/webmail-ui"

printf 'built %s\n' "$SMTP_IMAGE"
printf 'built %s\n' "$IMAP_IMAGE"
printf 'built %s\n' "$WEBMAIL_IMAGE"
