FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

RUN rm -rf /usr/local/lib/node_modules /opt/yarn* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  && apk upgrade --no-cache \
  && apk add --no-cache ca-certificates postfix bash setpriv \
  && test "$(apk version -t "$(postconf -h mail_version)" 3.11.2)" != "<" \
  && apk add --no-cache --virtual .identity-tools shadow \
  && groupmod -g 1500 postfix \
  && test "$(id -u postfix)" = 100 \
  && mkdir -p /config \
  && addgroup -g 5000 vmail \
  && usermod -u 5000 -g 5000 -d /var/mail/vhosts -s /sbin/nologin vmail \
  && apk del .identity-tools \
  && adduser -D -H -u 5010 -G vmail -s /sbin/nologin mapbuilder \
  && find /usr /bin /sbin -type f -perm /6000 -exec chmod a-s {} +

COPY main.cf /etc/postfix/main.cf
COPY master.cf /etc/postfix/master.cf
COPY account-map.mjs /usr/local/lib/mailbox/account-map.mjs
COPY virtual-mailbox-accounts /config/virtual-mailbox-accounts
COPY entrypoint.sh /usr/local/bin/mailbox-smtp-receiver-entrypoint
RUN chmod 0755 /usr/local/bin/mailbox-smtp-receiver-entrypoint

EXPOSE 2525 2587
ENTRYPOINT ["mailbox-smtp-receiver-entrypoint"]
