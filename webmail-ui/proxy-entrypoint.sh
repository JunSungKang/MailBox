#!/bin/sh
set -eu
umask 077
NGINX_WORKER_PROCESSES=${NGINX_WORKER_PROCESSES:-2}
case "$NGINX_WORKER_PROCESSES" in
  auto) ;;
  ''|*[!0-9]*) echo 'Invalid NGINX_WORKER_PROCESSES' >&2; exit 1 ;;
  *) [ "$NGINX_WORKER_PROCESSES" -ge 1 ] && [ "$NGINX_WORKER_PROCESSES" -le 128 ] || exit 1 ;;
esac
export NGINX_WORKER_PROCESSES
envsubst '${MAIL_WEB_HOSTNAME} ${MAIL_WEB_HTTPS_PORT} ${NGINX_WORKER_PROCESSES}' < /etc/nginx/mailbox.conf.template > /tmp/mailbox-nginx.conf
nginx -t -c /tmp/mailbox-nginx.conf
exec nginx -c /tmp/mailbox-nginx.conf -g 'daemon off;'
