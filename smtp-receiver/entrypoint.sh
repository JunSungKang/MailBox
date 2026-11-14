#!/usr/bin/env bash
set -euo pipefail

MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.ds-mail.p-e.kr}"
MAIL_DOMAINS="${MAIL_DOMAINS:-ds-mail.p-e.kr post.ds-mail.p-e.kr}"
SMTP_AUTH_USER="${SMTP_AUTH_USER:?SMTP_AUTH_USER is required}"
[[ "$SMTP_AUTH_USER" =~ ^[a-z0-9._-]{1,64}$ ]] || exit 1

# Privileged initialization only; preserve supported Postfix UID separation.
install -d -m 0755 -o vmail -g vmail /var/mail/vhosts
test "$(stat -c %u:%g /var/mail/vhosts)" = 5000:5000
install -d -m 0750 -o vmail -g vmail /accounts
if [[ ! -e /accounts/virtual-mailbox-accounts ]]; then
  install -m 0640 -o vmail -g vmail /config/virtual-mailbox-accounts /accounts/virtual-mailbox-accounts
fi
install -d -m 0755 -o mapbuilder -g vmail /var/lib/mailbox-maps
touch /var/log/postfix.log
chown root:postfix /var/log/postfix.log
chmod 0660 /var/log/postfix.log
# Never recursively rewrite a persisted spool's ownership.
for queue_dir in /var/spool/postfix/public /var/spool/postfix/maildrop; do
  if [[ -d "$queue_dir" ]]; then
    test "$(stat -c %g "$queue_dir")" = 102 || { echo 'Persisted postdrop GID mismatch' >&2; exit 1; }
  fi
done

postconf -e "myhostname = ${MAIL_HOSTNAME}"
postconf -e "virtual_mailbox_domains = ${MAIL_DOMAINS}"
# Network location never grants relay, even with a stale MYNETWORKS environment.
postconf -e 'mynetworks = 127.0.0.0/8'
printf '%s OK\n' "$SMTP_AUTH_USER" > /etc/postfix/submission-authorized
postmap lmdb:/etc/postfix/submission-authorized
chmod 0644 /etc/postfix/submission-authorized{,.lmdb}

setpriv --reuid=mapbuilder --regid=vmail --clear-groups --bounding-set=-all --no-new-privs \
  node /usr/local/lib/mailbox/account-map.mjs --once
postfix check

setpriv --reuid=mapbuilder --regid=vmail --clear-groups --bounding-set=-all --no-new-privs \
  node /usr/local/lib/mailbox/account-map.mjs &

# Standard low ports need NET_BIND_SERVICE; initialization-only capabilities are dropped.
exec setpriv --bounding-set=-all,+setuid,+setgid,+kill,+dac_override,+net_bind_service --inh-caps=-all --ambient-caps=-all --no-new-privs \
  postfix start-fg
