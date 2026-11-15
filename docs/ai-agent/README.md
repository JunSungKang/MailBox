# MailBox AI Agent Guide

Last updated: 2026-11-15

This area contains the rules AI agents must read before implementation, review or documentation work. Project background and human-oriented explanations belong in `docs/developer`.

## Required Reading

1. [Development Rules](./development-rules.md)
2. [Architecture Contract](./architecture-contract.md)
3. [Developer Onboarding](../developer/onboarding/mailbox-onboarding.md)
4. [System Architecture](../developer/architecture/system-architecture.md)

## Task-Specific Reading

- SMTP reception or address changes: [System Architecture](../developer/architecture/system-architecture.md), [Operation](../developer/guides/operation.md).
- IMAP or Maildir changes: [System Architecture](../developer/architecture/system-architecture.md), [Troubleshooting](../developer/guides/troubleshooting.md).
- Webmail authentication, mailbox or sending changes: [Architecture Contract](./architecture-contract.md), [User Guide](../developer/guides/user-guide.md).
- Compose, environment variable or volume changes: [Installation](../developer/guides/installation.md), [Operation](../developer/guides/operation.md).

## Non-Negotiable Rule

Inspect the existing implementation and user diff first. Run the affected module's builds/tests and check related documentation links. Never put message bodies, passwords, session secrets, signup codes or tokens in code, logs or documentation examples. Write all maintained documentation in English.
