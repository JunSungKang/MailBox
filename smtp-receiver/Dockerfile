ARG NODE_IMAGE=mailbox-node24:ubuntu26.04
FROM ${NODE_IMAGE}
ENV DEBIAN_FRONTEND=noninteractive
# Preserve persisted Postfix UID/GID and postdrop GID from the existing spool.
RUN groupadd -g 1500 postfix && useradd -r -u 100 -g postfix -d /var/spool/postfix -s /usr/sbin/nologin postfix \
 && groupadd -g 102 postdrop \
 && groupadd -g 5000 vmail && useradd -u 5000 -g vmail -d /var/mail/vhosts -s /usr/sbin/nologin vmail \
 && useradd -u 5010 -g vmail -M -s /usr/sbin/nologin mapbuilder \
 && printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod 0755 /usr/sbin/policy-rc.d \
 && apt-get update && apt-get dist-upgrade -y \
 && apt-get install -y --no-install-recommends postfix postfix-lmdb bash util-linux ca-certificates \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' postfix)" ge 3.10.6-4ubuntu2.2 \
 && postconf -m | grep -qx lmdb \
 && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
 && install -d -m 0755 -o mapbuilder -g vmail /var/lib/mailbox-maps /config \
 && find /usr -type f -perm /6000 -exec chmod a-s {} +
COPY main.cf /etc/postfix/main.cf
COPY master.cf /etc/postfix/master.cf
COPY account-map.mjs /usr/local/lib/mailbox/account-map.mjs
COPY virtual-mailbox-accounts /config/virtual-mailbox-accounts
COPY entrypoint.sh /usr/local/bin/mailbox-smtp-receiver-entrypoint
RUN chmod 0755 /usr/local/bin/mailbox-smtp-receiver-entrypoint
EXPOSE 25 587 2525 2587
ENTRYPOINT ["mailbox-smtp-receiver-entrypoint"]
