#!/usr/bin/env sh
set -eu

mkdir -p \
  /app/data/mail/inbox \
  /app/data/mail/sent \
  /app/data/mail/bounced \
  /app/data/tmp \
  /app/data/drop/inbox \
  /app/data/drop/processed \
  /app/data/drop/failed

account_wait_count=0
while [ ! -f /accounts/dovecot-users ] || [ ! -f /accounts/virtual-mailbox-accounts ]; do
  account_wait_count=$((account_wait_count + 1))
  if [ "$account_wait_count" -ge 30 ]; then
    echo "Account store was not initialized by the mail services" >&2
    exit 1
  fi
  sleep 1
done

chown -R nextjs:vmail /app/data
chown -R nextjs:vmail /accounts
chmod 0750 /accounts
chmod 0640 /accounts/dovecot-users /accounts/virtual-mailbox-accounts

exec su-exec nextjs:vmail "$@"
