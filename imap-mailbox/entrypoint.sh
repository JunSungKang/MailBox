#!/usr/bin/env bash
set -euo pipefail

MAILBOX_ROOT="/var/mail/vhosts/mailbox/Maildir"
ACCOUNT_DIR="/accounts"
ACCOUNT_FILE="$ACCOUNT_DIR/dovecot-users"

install -d -m 0755 -o vmail -g vmail /var/mail/vhosts
install -d -m 0755 -o vmail -g vmail "$MAILBOX_ROOT" "$MAILBOX_ROOT/cur" "$MAILBOX_ROOT/new" "$MAILBOX_ROOT/tmp"
chown -R vmail:vmail /var/mail/vhosts

install -d -m 0750 -o vmail -g vmail "$ACCOUNT_DIR"
if [[ ! -e "$ACCOUNT_FILE" ]]; then
  install -m 0640 -o vmail -g vmail /etc/dovecot/users "$ACCOUNT_FILE"
fi
chown vmail:vmail "$ACCOUNT_FILE"
chmod 0640 "$ACCOUNT_FILE"

exec dovecot -F
