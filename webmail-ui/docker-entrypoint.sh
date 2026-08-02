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

chown -R nextjs:vmail /app/data

exec su-exec nextjs:vmail "$@"
