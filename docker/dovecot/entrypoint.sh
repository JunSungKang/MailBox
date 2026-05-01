#!/usr/bin/env bash
set -euo pipefail

MAILBOX_ROOT="/var/mail/vhosts/mailbox/Maildir"

install -d -m 0755 -o vmail -g vmail /var/mail/vhosts
install -d -m 0755 -o vmail -g vmail "$MAILBOX_ROOT" "$MAILBOX_ROOT/cur" "$MAILBOX_ROOT/new" "$MAILBOX_ROOT/tmp"
chown -R vmail:vmail /var/mail/vhosts

exec dovecot -F
