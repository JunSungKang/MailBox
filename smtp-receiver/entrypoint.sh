#!/usr/bin/env bash
set -euo pipefail

MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.ds-mail.p-e.kr}"
MAIL_DOMAINS="${MAIL_DOMAINS:-ds-mail.p-e.kr post.ds-mail.p-e.kr}"
MYNETWORKS="${MYNETWORKS:-127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16}"
MAILBOX_ROOT="/var/mail/vhosts/mailbox/Maildir"
SOURCE_ACCOUNT_MAP="/config/virtual-mailbox-accounts"
ACCOUNT_MAP="/etc/postfix/maps/virtual-mailbox-accounts"

install -d -m 0755 -o vmail -g vmail /var/mail/vhosts
install -d -m 0755 -o vmail -g vmail "$MAILBOX_ROOT" "$MAILBOX_ROOT/cur" "$MAILBOX_ROOT/new" "$MAILBOX_ROOT/tmp"
chown -R vmail:vmail /var/mail/vhosts
install -d -m 0755 /etc/postfix/maps
touch /var/log/postfix.log
chown postfix:postfix /var/log/postfix.log

postconf -e "myhostname = ${MAIL_HOSTNAME}"
postconf -e "virtual_mailbox_domains = ${MAIL_DOMAINS}"
postconf -e "mynetworks = ${MYNETWORKS}"

if [[ ! -s "$SOURCE_ACCOUNT_MAP" ]]; then
  printf 'Missing or empty account map: %s\n' "$SOURCE_ACCOUNT_MAP" >&2
  exit 1
fi

install -m 0644 "$SOURCE_ACCOUNT_MAP" "$ACCOUNT_MAP"
sort -u "$ACCOUNT_MAP" -o "$ACCOUNT_MAP"
postmap "$ACCOUNT_MAP"
postfix check

exec postfix start-fg
