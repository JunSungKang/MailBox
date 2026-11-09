#!/bin/bash
set -eu

MAILBOX_ROOT="/var/mail/vhosts/mailbox/Maildir"
ACCOUNT_DIR="/accounts"
ACCOUNT_FILE="$ACCOUNT_DIR/dovecot-users"

install -d -m 0755 -o vmail -g vmail /var/mail/vhosts
install -d -m 0755 -o vmail -g vmail "$MAILBOX_ROOT" "$MAILBOX_ROOT/cur" "$MAILBOX_ROOT/new" "$MAILBOX_ROOT/tmp"
test "$(stat -c %u:%g /var/mail/vhosts)" = 5000:5000

install -d -m 0750 -o vmail -g vmail "$ACCOUNT_DIR"
if [[ ! -e "$ACCOUNT_FILE" ]]; then
  install -m 0640 -o vmail -g vmail /etc/dovecot/users "$ACCOUNT_FILE"
fi
test "$(stat -c %u:%g:%a "$ACCOUNT_FILE")" = 5000:5000:640

install -d -m 0750 -o root -g smtp-auth /run/smtp-auth
doveconf -n >/dev/null
exec dovecot -F
