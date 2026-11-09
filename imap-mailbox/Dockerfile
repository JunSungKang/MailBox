ARG UBUNTU_IMAGE=ubuntu:26.04@sha256:6a06111c3b0a8600feadb270aec771dc239bf407b25625f93f44ab00e11f4d3c
FROM ${UBUNTU_IMAGE}
ENV DEBIAN_FRONTEND=noninteractive
RUN groupadd -g 1500 smtp-auth && groupadd -g 5000 vmail \
 && useradd -u 5000 -g vmail -d /var/mail/vhosts -s /usr/sbin/nologin vmail \
 && printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod 0755 /usr/sbin/policy-rc.d \
 && apt-get update && apt-get dist-upgrade -y \
 && apt-get install -y --no-install-recommends ca-certificates dovecot-core dovecot-imapd \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' dovecot-core)" ge '1:2.4.2+dfsg1-3ubuntu2.1' \
 && dovecot --version | grep -q '^2\.4\.' \
 && doveadm pw -l | grep -q ARGON2ID \
 && rm -rf /var/lib/apt/lists/* \
 && find /usr -type f -perm /6000 -exec chmod a-s {} +
COPY dovecot.conf /etc/dovecot/dovecot.conf
COPY users /etc/dovecot/users
COPY entrypoint.sh /usr/local/bin/mailbox-imap-mailbox-entrypoint
RUN chmod 0755 /usr/local/bin/mailbox-imap-mailbox-entrypoint \
 && chown root:dovecot /etc/dovecot/users && chmod 0640 /etc/dovecot/users
EXPOSE 143
ENTRYPOINT ["mailbox-imap-mailbox-entrypoint"]
