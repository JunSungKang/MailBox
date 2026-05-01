FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates postfix \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /config

COPY main.cf /etc/postfix/main.cf
COPY virtual-mailbox-accounts /config/virtual-mailbox-accounts
COPY entrypoint.sh /usr/local/bin/mail-smtp-receiver-entrypoint

RUN chmod 0755 /usr/local/bin/mail-smtp-receiver-entrypoint \
  && groupadd -g 5000 vmail \
  && useradd -u 5000 -g 5000 -d /var/mail/vhosts -s /usr/sbin/nologin vmail

EXPOSE 25

ENTRYPOINT ["mail-smtp-receiver-entrypoint"]
