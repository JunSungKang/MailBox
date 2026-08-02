#!/usr/bin/env bash
set -euo pipefail

MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.ds-mail.p-e.kr}"
MAIL_DOMAINS="${MAIL_DOMAINS:-ds-mail.p-e.kr post.ds-mail.p-e.kr}"
MYNETWORKS="${MYNETWORKS:-127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16}"
MAILBOX_ROOT="/var/mail/vhosts/mailbox/Maildir"
ACCOUNT_STORE="/accounts/virtual-mailbox-accounts"
SOURCE_ACCOUNT_MAP="$ACCOUNT_STORE"
ACCOUNT_MAP="/etc/postfix/maps/virtual-mailbox-accounts"

install -d -m 0755 -o vmail -g vmail /var/mail/vhosts
install -d -m 0755 -o vmail -g vmail "$MAILBOX_ROOT" "$MAILBOX_ROOT/cur" "$MAILBOX_ROOT/new" "$MAILBOX_ROOT/tmp"
chown -R vmail:vmail /var/mail/vhosts
install -d -m 0755 /etc/postfix/maps
install -d -m 0750 -o vmail -g vmail /accounts
if [[ ! -e "$ACCOUNT_STORE" ]]; then
  install -m 0640 -o vmail -g vmail /config/virtual-mailbox-accounts "$ACCOUNT_STORE"
fi
touch /var/log/postfix.log
chown postfix:postfix /var/log/postfix.log

postconf -e "myhostname = ${MAIL_HOSTNAME}"
postconf -e "virtual_mailbox_domains = ${MAIL_DOMAINS}"
postconf -e "mynetworks = ${MYNETWORKS}"

if [[ ! -s "$SOURCE_ACCOUNT_MAP" ]]; then
  printf 'Missing or empty account map: %s\n' "$SOURCE_ACCOUNT_MAP" >&2
  exit 1
fi

rebuild_account_map() {
  if ! awk 'NF == 0 || $1 ~ /^#/ || (NF == 2 && $1 ~ /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/ && $2 ~ /^[A-Za-z0-9._-]+\/Maildir\/$/) { next } { exit 1 }' "$SOURCE_ACCOUNT_MAP"; then
    printf '{"time":"%s","level":"ERROR","event":"mail.account_map.invalid"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
    return 1
  fi
  install -m 0644 "$SOURCE_ACCOUNT_MAP" "$ACCOUNT_MAP.new"
  sort -u "$ACCOUNT_MAP.new" -o "$ACCOUNT_MAP.new"
  mv "$ACCOUNT_MAP.new" "$ACCOUNT_MAP"
  postmap "$ACCOUNT_MAP"
}

rebuild_account_map
postfix check

(
  previous_checksum="$(sha256sum "$SOURCE_ACCOUNT_MAP" | awk '{print $1}')"
  while sleep 2; do
    current_checksum="$(sha256sum "$SOURCE_ACCOUNT_MAP" | awk '{print $1}')"
    if [[ "$current_checksum" != "$previous_checksum" ]]; then
      if rebuild_account_map; then
        if postfix reload; then
          previous_checksum="$current_checksum"
          printf '{"time":"%s","level":"INFO","event":"mail.account_map.reload.success"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        else
          printf '{"time":"%s","level":"ERROR","event":"mail.account_map.reload.failure"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
        fi
      fi
    fi
  done
) &

exec postfix start-fg
