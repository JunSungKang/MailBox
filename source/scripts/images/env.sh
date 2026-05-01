#!/usr/bin/env bash
set -euo pipefail

ENV_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
IMAGE_ENV_FILE="${IMAGE_ENV_FILE:-$ENV_SCRIPT_DIR/images.env}"

load_image_env_file() {
  env_file="$1"
  [ -f "$env_file" ] || return 0

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
      export\ *) line=${line#export } ;;
    esac
    case "$line" in
      *=*) ;;
      *) continue ;;
    esac

    key=${line%%=*}
    value=${line#*=}
    case "$key" in
      REGISTRY|NAMESPACE|IMAGE_NAMESPACE|VERSION|IMAGE_NAME_PREFIX|SMTP_IMAGE|MAIL_SMTP_RECEIVER_IMAGE|IMAP_IMAGE|MAIL_IMAP_MAILBOX_IMAGE|WEBMAIL_IMAGE|MAIL_WEBMAIL_UI_IMAGE|GITHUB_USERNAME|GHCR_USERNAME|GIT_TOKEN|GHCR_TOKEN)
        if [ -z "${!key+x}" ]; then
          printf -v "$key" '%s' "$value"
        fi
        ;;
      *)
        printf 'Ignoring unsupported image env key: %s\n' "$key" >&2
        ;;
    esac
  done < "$env_file"
}

load_image_env_file "$IMAGE_ENV_FILE"

REGISTRY="${REGISTRY:-ghcr.io}"
NAMESPACE="${NAMESPACE:-${IMAGE_NAMESPACE:-junsungkang}}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-$NAMESPACE}"
VERSION="${VERSION:-v1.0.0}"
IMAGE_NAME_PREFIX="${IMAGE_NAME_PREFIX:-mail-server-}"

image_ref() {
  image_name="$1"
  printf '%s/%s/%s%s:%s\n' "$REGISTRY" "$IMAGE_NAMESPACE" "$IMAGE_NAME_PREFIX" "$image_name" "$VERSION"
}

SMTP_IMAGE="${SMTP_IMAGE:-${MAIL_SMTP_RECEIVER_IMAGE:-$(image_ref smtp-receiver)}}"
IMAP_IMAGE="${IMAP_IMAGE:-${MAIL_IMAP_MAILBOX_IMAGE:-$(image_ref imap-mailbox)}}"
WEBMAIL_IMAGE="${WEBMAIL_IMAGE:-${MAIL_WEBMAIL_UI_IMAGE:-$(image_ref webmail-ui)}}"

MAIL_SMTP_RECEIVER_IMAGE="${MAIL_SMTP_RECEIVER_IMAGE:-$SMTP_IMAGE}"
MAIL_IMAP_MAILBOX_IMAGE="${MAIL_IMAP_MAILBOX_IMAGE:-$IMAP_IMAGE}"
MAIL_WEBMAIL_UI_IMAGE="${MAIL_WEBMAIL_UI_IMAGE:-$WEBMAIL_IMAGE}"
GHCR_USERNAME="${GHCR_USERNAME:-${GITHUB_USERNAME:-}}"
GIT_TOKEN="${GIT_TOKEN:-}"
GHCR_TOKEN="${GHCR_TOKEN:-$GIT_TOKEN}"

export REGISTRY NAMESPACE IMAGE_NAMESPACE VERSION IMAGE_NAME_PREFIX
export SMTP_IMAGE IMAP_IMAGE WEBMAIL_IMAGE
export MAIL_SMTP_RECEIVER_IMAGE MAIL_IMAP_MAILBOX_IMAGE MAIL_WEBMAIL_UI_IMAGE
export GHCR_USERNAME GIT_TOKEN GHCR_TOKEN
