#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEFAULT_SMTP_RECEIVER_MAP="${PROJECT_DIR}/apps/smtp-receiver/virtual-mailbox-accounts"
if [[ -f "${PROJECT_DIR}/config/postfix/virtual-mailbox-accounts" ]]; then
  DEFAULT_SMTP_RECEIVER_MAP="${PROJECT_DIR}/config/postfix/virtual-mailbox-accounts"
fi

SMTP_RECEIVER_MAP="${SMTP_RECEIVER_MAP:-${POSTFIX_MAP:-${DEFAULT_SMTP_RECEIVER_MAP}}}"
SMTP_RECEIVER_CONTAINER_MAP="${SMTP_RECEIVER_CONTAINER_MAP:-${POSTFIX_CONTAINER_MAP:-/etc/postfix/maps/virtual-mailbox-accounts}}"
MAILBOX_PATH="${MAILBOX_PATH:-mailbox/Maildir/}"
DOMAINS="${DOMAINS:-ds-mail.p-e.kr post.ds-mail.p-e.kr}"
COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_DIR}/deploy/local/docker-compose.yml}"
SMTP_RECEIVER_SERVICE="${SMTP_RECEIVER_SERVICE:-${POSTFIX_SERVICE:-mail-smtp-receiver}}"

usage() {
  cat <<'EOF'
Usage:
  source/scripts/verify/mail-user-add.sh add <local-part|email> [...]
  source/scripts/verify/mail-user-add.sh remove <local-part|email> [...]
  source/scripts/verify/mail-user-add.sh list

Examples:
  source/scripts/verify/mail-user-add.sh add alice
  source/scripts/verify/mail-user-add.sh add alice@ds-mail.p-e.kr
  source/scripts/verify/mail-user-add.sh remove alice
  DOMAINS="ds-mail.p-e.kr" source/scripts/verify/mail-user-add.sh add alice

Environment:
  SMTP_RECEIVER_MAP            Default: <source>/apps/smtp-receiver/virtual-mailbox-accounts
  SMTP_RECEIVER_CONTAINER_MAP  Default: /etc/postfix/maps/virtual-mailbox-accounts
  MAILBOX_PATH                 Default: mailbox/Maildir/
  DOMAINS                      Default: ds-mail.p-e.kr post.ds-mail.p-e.kr
  COMPOSE_FILE                 Default: <source>/deploy/local/docker-compose.yml
  SMTP_RECEIVER_SERVICE        Default: mail-smtp-receiver

Compatibility:
  POSTFIX_MAP, POSTFIX_CONTAINER_MAP, POSTFIX_SERVICE are still accepted.
EOF
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

validate_local_part() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9.!#$%\&\'*+/=?^_\`{|}~-]+$ ]]
}

validate_domain() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9.-]+$ ]]
}

validate_email() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9.!#$%\&\'*+/=?^_\`{|}~-]+@[A-Za-z0-9.-]+$ ]]
}

normalize_input() {
  local value="$1"
  value="${value,,}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

addresses_for_value() {
  local value
  value="$(normalize_input "$1")"

  if [[ "$value" == *"@"* ]]; then
    if ! validate_email "$value"; then
      printf 'Invalid email address: %s\n' "$1" >&2
      return 1
    fi
    printf '%s\n' "$value"
    return 0
  fi

  if ! validate_local_part "$value"; then
    printf 'Invalid local part: %s\n' "$1" >&2
    return 1
  fi

  local domain
  for domain in $DOMAINS; do
    domain="$(normalize_input "$domain")"
    if ! validate_domain "$domain"; then
      printf 'Invalid domain in DOMAINS: %s\n' "$domain" >&2
      return 1
    fi
    printf '%s@%s\n' "$value" "$domain"
  done
}

ensure_map() {
  install -d -m 0755 "$(dirname "$SMTP_RECEIVER_MAP")"
  if [[ ! -f "$SMTP_RECEIVER_MAP" ]]; then
    install -m 0644 /dev/null "$SMTP_RECEIVER_MAP"
  fi
}

address_exists() {
  local address="$1"
  awk -v address="$address" '$1 == address { found = 1 } END { exit found ? 0 : 1 }' "$SMTP_RECEIVER_MAP"
}

refresh_smtp_receiver_if_running() {
  sort -u "$SMTP_RECEIVER_MAP" -o "$SMTP_RECEIVER_MAP"

  if ! docker compose -f "$COMPOSE_FILE" ps --services --filter status=running | grep -Fxq "$SMTP_RECEIVER_SERVICE"; then
    log "mail-smtp-receiver container is not running; map will be compiled on next container start"
    return 0
  fi

  docker compose -f "$COMPOSE_FILE" cp "$SMTP_RECEIVER_MAP" "${SMTP_RECEIVER_SERVICE}:${SMTP_RECEIVER_CONTAINER_MAP}"
  docker compose -f "$COMPOSE_FILE" exec -T "$SMTP_RECEIVER_SERVICE" sh -lc \
    "chown root:root '$SMTP_RECEIVER_CONTAINER_MAP' && rm -f '${SMTP_RECEIVER_CONTAINER_MAP}.db'"
  docker compose -f "$COMPOSE_FILE" exec -T "$SMTP_RECEIVER_SERVICE" postmap "$SMTP_RECEIVER_CONTAINER_MAP"
  docker compose -f "$COMPOSE_FILE" exec -T "$SMTP_RECEIVER_SERVICE" postfix check
  docker compose -f "$COMPOSE_FILE" exec -T "$SMTP_RECEIVER_SERVICE" postfix reload
  log "reloaded mail-smtp-receiver container"
}

list_accounts() {
  ensure_map
  if [[ ! -s "$SMTP_RECEIVER_MAP" ]]; then
    log "no mail accounts configured in ${SMTP_RECEIVER_MAP}"
    return 0
  fi
  cat "$SMTP_RECEIVER_MAP"
}

add_accounts() {
  ensure_map
  local changed=0
  local item address

  for item in "$@"; do
    while IFS= read -r address; do
      [[ -n "$address" ]] || continue
      if address_exists "$address"; then
        log "already exists: ${address}"
        continue
      fi
      printf '%s %s\n' "$address" "$MAILBOX_PATH" >> "$SMTP_RECEIVER_MAP"
      log "added: ${address} -> ${MAILBOX_PATH}"
      changed=1
    done < <(addresses_for_value "$item")
  done

  if [[ "$changed" == "1" ]]; then
    refresh_smtp_receiver_if_running
  else
    log "no changes"
  fi
}

remove_accounts() {
  ensure_map
  local tmp_file
  tmp_file="$(mktemp)"

  cp "$SMTP_RECEIVER_MAP" "$tmp_file"

  local changed=0
  local item address
  for item in "$@"; do
    while IFS= read -r address; do
      [[ -n "$address" ]] || continue
      if awk -v address="$address" '$1 == address { found = 1 } END { exit found ? 0 : 1 }' "$tmp_file"; then
        awk -v address="$address" '$1 != address' "$tmp_file" > "${tmp_file}.next"
        mv "${tmp_file}.next" "$tmp_file"
        log "removed: ${address}"
        changed=1
      else
        log "not found: ${address}"
      fi
    done < <(addresses_for_value "$item")
  done

  if [[ "$changed" == "1" ]]; then
    install -m 0644 "$tmp_file" "$SMTP_RECEIVER_MAP"
    refresh_smtp_receiver_if_running
  else
    log "no changes"
  fi

  rm -f "$tmp_file"
}

main() {
  local command="${1:-}"
  case "$command" in
    add)
      shift
      [[ "$#" -gt 0 ]] || { usage >&2; exit 1; }
      add_accounts "$@"
      ;;
    remove|rm|delete|del)
      shift
      [[ "$#" -gt 0 ]] || { usage >&2; exit 1; }
      remove_accounts "$@"
      ;;
    list|ls)
      list_accounts
      ;;
    -h|--help|help|"")
      usage
      ;;
    *)
      printf 'Unknown command: %s\n\n' "$command" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
