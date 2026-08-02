FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates dovecot-core dovecot-imapd \
  && rm -rf /var/lib/apt/lists/*

COPY dovecot.conf /etc/dovecot/dovecot.conf
COPY users /etc/dovecot/users
COPY entrypoint.sh /usr/local/bin/mail-imap-mailbox-entrypoint

RUN chmod 0755 /usr/local/bin/mail-imap-mailbox-entrypoint \
  && groupadd -g 5000 vmail \
  && useradd -u 5000 -g 5000 -d /var/mail/vhosts -s /usr/sbin/nologin vmail \
  && chown root:dovecot /etc/dovecot/users \
  && chmod 0640 /etc/dovecot/users

EXPOSE 143

ENTRYPOINT ["mail-imap-mailbox-entrypoint"]
