#!/usr/bin/env bash
set -euo pipefail

MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.ds-mail.p-e.kr}"
MAIL_DOMAINS="${MAIL_DOMAINS:-ds-mail.p-e.kr post.ds-mail.p-e.kr}"
SMTP_AUTH_USER="${SMTP_AUTH_USER:?SMTP_AUTH_USER is required}"
[[ "$SMTP_AUTH_USER" =~ ^[a-z0-9._-]{1,64}$ ]] || exit 1

# Privileged initialization only; preserve supported Postfix UID separation.
install -d -m 0755 -o vmail -g vmail /var/mail/vhosts
chown -R vmail:vmail /var/mail/vhosts
install -d -m 0750 -o vmail -g vmail /accounts
if [[ ! -e /accounts/virtual-mailbox-accounts ]]; then
  install -m 0640 -o vmail -g vmail /config/virtual-mailbox-accounts /accounts/virtual-mailbox-accounts
fi
install -d -m 0755 -o mapbuilder -g vmail /var/lib/mailbox-maps
touch /var/log/postfix.log
chown root:postfix /var/log/postfix.log
chmod 0660 /var/log/postfix.log
for queue_dir in /var/spool/postfix/public /var/spool/postfix/maildrop; do
  # Preserve existing queues while migrating the distribution's postdrop GID.
  if [[ -d "$queue_dir" ]]; then chgrp postdrop "$queue_dir"; fi
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

# Host 25 maps to container 2525; startup chown/fowner capabilities are dropped.
exec setpriv --bounding-set=-all,+setuid,+setgid,+kill,+dac_override --inh-caps=-all --ambient-caps=-all --no-new-privs \
  postfix start-fg
