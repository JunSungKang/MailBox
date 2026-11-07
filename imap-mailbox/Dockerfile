FROM alpine:3.24@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a

RUN apk upgrade --no-cache \
  && apk add --no-cache ca-certificates dovecot icu-data-full \
  && addgroup -g 1500 smtp-auth \
  && addgroup -g 5000 vmail \
  && adduser -D -H -u 5000 -G vmail -h /var/mail/vhosts -s /sbin/nologin vmail \
  && find /usr /bin /sbin -type f -perm /6000 -exec chmod a-s {} +

COPY dovecot.conf /etc/dovecot/dovecot.conf
COPY users /etc/dovecot/users
COPY entrypoint.sh /usr/local/bin/mailbox-imap-mailbox-entrypoint

RUN chmod 0755 /usr/local/bin/mailbox-imap-mailbox-entrypoint \
  && chown root:dovecot /etc/dovecot/users \
  && chmod 0640 /etc/dovecot/users

EXPOSE 143

ENTRYPOINT ["mailbox-imap-mailbox-entrypoint"]
