#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/env.sh"

if [ -n "$GHCR_USERNAME" ] && [ -n "$GHCR_TOKEN" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login "$REGISTRY" -u "$GHCR_USERNAME" --password-stdin
fi

docker push "$SMTP_IMAGE"
docker push "$IMAP_IMAGE"
docker push "$WEBMAIL_IMAGE"

printf 'pushed %s\n' "$SMTP_IMAGE"
printf 'pushed %s\n' "$IMAP_IMAGE"
printf 'pushed %s\n' "$WEBMAIL_IMAGE"
