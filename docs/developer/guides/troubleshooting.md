# MailBox Troubleshooting

## Image Pull Failure

- Check the registry address and image tag in `.env` or the selected Compose override.
- For a private registry, check `docker login` authentication.
- In an offline environment, load the image archive with `docker load` first.

## Container Startup Failure

```bash
docker compose -f compose.platform.yaml ps
docker compose -f compose.platform.yaml logs mailbox-smtp-receiver
docker compose -f compose.platform.yaml logs mailbox-imap-mailbox
docker compose -f compose.platform.yaml logs mailbox-webmail-ui
docker compose -f compose.platform.yaml logs mailbox-webmail-proxy
```

For port conflicts, inspect `SMTP_PORT`, `IMAP_PORT` and the selected model's Webmail mappings. Standalone platform HTTP/HTTPS use fixed host ports `20005`/`20006`; older models use `MAIL_WEB_PORT`/`MAIL_WEB_HTTPS_PORT`. Confirm that `MAIL_TLS_DIR` exists and container root can read `fullchain.pem` and `privkey.pem`.

## STARTTLS or Certificate Errors

- IMAP uses STARTTLS on `143`. Login is rejected before TLS.
- The certificate SAN must contain the actual server address entered in the client. Domains and IPs are separate SAN types.
- For a local CA, trust the public CA certificate on the connecting device. Never distribute its private key.
- Check expiry, missing intermediate certificates and certificate/key mismatch. Follow the [TLS operating procedure](./operation.md#tls-checks-and-certificate-rotation) after replacement.
- Inspect SMTP TLS errors and IMAP `Failed to initialize SSL server context` messages.

## Mail Reception Failure

- Check that DNS `MX` records point to the correct mail hostname.
- Allow inbound TCP 25 in both cloud and OS firewalls.
- Inspect recipient-map failures in `mailbox-smtp-receiver` logs.
- Immediately after signup, check account-map validation and `postmap` errors in SMTP logs.

## Signup or Login Failure

- Look for `auth.signup.provision_failure`, `auth.signup.exists` and `auth.login.backend_failure` in Webmail logs.
- Confirm in Compose configuration that `mailbox-account-store` is mounted by all three mail services.
- Check that the Dovecot user file and Postfix recipient map have the required UID/GID `5000` read/write access.
- Legacy `users.json` accounts are not converted automatically. Sign up with the same ID and original password; no signup code is needed. Existing recipient addresses are reserved too. Operators must verify original ownership before recovering alias/orphan IDs without ownership records.
- Confirm that the IMAP authentication process has `extra_groups = vmail`. Do not make the account directory world-accessible as a workaround.

## Webmail Access Failure

- Check `mailbox-webmail-ui` container state and logs.
- Allow the selected HTTPS port in the firewall. Standalone production defaults to `20006`; shared-edge deployments may differ.
- Confirm DNS `A` points to the real server IP and `MAIL_WEB_HOSTNAME` matches the connection address. An A record does not specify a Web port.
- Check `https://<hostname>:20006/login`. Use `curl --cacert <public-ca-certificate>` with a local CA.
- Development Compose exposes HTTP on loopback only. Use production Compose for external access.

## Secure SMTP Submission Failure

`SMTP_URL`, `ignoreTLS` and sendmail fallback are unsupported. Confirm that `SMTP_AUTH_USER`/`SMTP_AUTH_PASSWORD` match the dedicated account, and that `MAIL_SMTP_CA_FILE` and `MAIL_HOSTNAME` match the certificate chain/SAN. `node smtp-bootstrap.mjs` checks actual STARTTLS/SASL without overwriting an existing account. The application does not log raw SMTP responses or passwords. Postfix defers outbound mail when destination TLS/hostname verification fails; there is no plaintext retry.

The [Ubuntu platform transition](ubuntu-platform-transition.md) covers builds, shared locking, real volumes, compatibility endpoints and rollback. Older `docker-compose*.yml` models are recovery references for their corresponding older commits/images.
