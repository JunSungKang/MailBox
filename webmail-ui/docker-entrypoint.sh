#!/usr/bin/env sh
set -eu

account_wait_count=0
while [ ! -f /accounts/dovecot-users ] || [ ! -f /accounts/virtual-mailbox-accounts ]; do
  account_wait_count=$((account_wait_count + 1))
  if [ "$account_wait_count" -ge 30 ]; then
    echo "Account store was not initialized by the mail services" >&2
    exit 1
  fi
  sleep 1
done

# Existing data must already have the shared identity; never rewrite a tree.
for directory in /app/data /accounts; do
  test "$(stat -c %u:%g "$directory")" = 5000:5000 || { echo 'Persisted shared UID/GID mismatch' >&2; exit 1; }
done
for file in /accounts/dovecot-users /accounts/virtual-mailbox-accounts; do
  test "$(stat -c %u:%g:%a "$file")" = 5000:5000:640 || exit 1
done
exec setpriv --reuid=nextjs --regid=vmail --clear-groups --bounding-set=-all --no-new-privs "$@"
