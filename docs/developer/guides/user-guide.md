# MailBox User Guide

## Webmail Access

Standalone production Webmail is available at `https://<MAIL_WEB_HOSTNAME>:20006`; HTTP `20005` redirects to HTTPS. Older models can use `MAIL_WEB_HTTPS_PORT`, while shared-edge installations have their own public mapping. Ask the operator for the actual URL. With a local CA, trust the operator-provided public CA certificate on your device. Development Compose uses `http://localhost:18080`.

The “Tomorrow's Mailbox” theme uses bright pearl, mint and lavender colors with translucent panels. Its login tagline means “Where tomorrow speaks to you first.” Message dates are actual receiving/sending timestamps. Enabling reduced motion on your device reduces decorative animation. The current interface is Korean; the descriptions below translate its controls into English.

Create an account with your chosen user ID and an 8–128-character password. No signup code is required. Public signup cannot claim an existing address or a reserved SMTP service ID. Non-ASCII passwords are not shortened according to their UTF-8 byte count. Webmail and IMAP share credentials; NUL characters are prohibited by the shared authentication format. User IDs `.` and `..` are invalid. Successful signup creates Webmail/IMAP access and SMTP receiving addresses for the operator's allowed domains.

Legacy `users.json` users must sign up again with the same ID and original password. An ID cannot be claimed without proof of ownership. If the original password is outside 8–128 characters, contains NUL, or the account record is damaged, ask an operator for ownership-verified recovery. Accounts already migrated to Dovecot retain their login and password.

## Mailboxes

- **Inbox**: received messages.
- **Sent**: messages sent through Webmail.
- **Returned mail**: bounced or failed messages.

## Compose

Enter recipients, subject and body on the compose page, then send. Recipients without a domain receive `MAIL_DEFAULT_DOMAIN`. The sender is fixed to the logged-in user and default domain.

## IMAP Access

- Server: the installation's mail hostname.
- Port: `143`.
- Connection security: `STARTTLS`, TLS 1.2 or later.
- Username: the user ID registered in Webmail.
- Password: the password chosen at signup.

Log in only after STARTTLS. The configured server address must match a domain or IP in the certificate. SMTP `25` is for server-to-server reception; users send through Webmail's compose page. Ordinary IMAP credentials do not grant the dedicated application's SMTP relay permission.

Outgoing SMTP requires encryption and server-certificate verification. Delivery may be delayed when a destination does not support this policy; the operator must inspect the queue. A successful Webmail submission means Postfix accepted the message, not that the destination delivered it.

The [Ubuntu platform transition](ubuntu-platform-transition.md) covers builds, shared locking, real volumes, compatibility endpoints and rollback. Older `docker-compose*.yml` models are recovery references for their corresponding older commits/images.
