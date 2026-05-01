#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
. "$SCRIPT_DIR/env.sh"

OUTPUT="${OUTPUT:-$SOURCE_ROOT/release/images.lock}"
mkdir -p "$(dirname "$OUTPUT")"

write_image_line() {
  name="$1"
  image="$2"
  digest=$(docker image inspect "$image" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)
  if [ -n "$digest" ] && [ "$digest" != "<no value>" ]; then
    printf '%s=%s\n' "$name" "$digest"
  else
    printf '%s=%s\n' "$name" "$image"
  fi
}

{
  write_image_line smtp-receiver "$SMTP_IMAGE"
  write_image_line imap-mailbox "$IMAP_IMAGE"
  write_image_line webmail-ui "$WEBMAIL_IMAGE"
} > "$OUTPUT"

printf '%s\n' "$OUTPUT"
