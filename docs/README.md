# MailBox Documentation

Last updated: 2026-11-15

Documentation is organized by audience and purpose. Put new documents in the appropriate area and update this index. Write all repository documentation in English.

## AI Agent

- [AI Agent Guide](./ai-agent/README.md): required reading and task-specific references.
- [Development Rules](./ai-agent/development-rules.md): scope, security, logging and validation invariants.
- [Architecture Contract](./ai-agent/architecture-contract.md): module ownership and allowed dependencies.

## Developer

- [Developer Guide](./developer/README.md): recommended reading order.
- [MailBox Onboarding](./developer/onboarding/mailbox-onboarding.md): stack, commands and code entry points.
- [System Architecture](./developer/architecture/system-architecture.md): containers, storage, authentication and mail flow.
- [Installation](./developer/guides/installation.md): development and production setup.
- [Operation](./developer/guides/operation.md): logs, restarts, image replacement and account management.
- [Troubleshooting](./developer/guides/troubleshooting.md): startup, delivery and Webmail diagnostics.
- [User Guide](./developer/guides/user-guide.md): Webmail and IMAP access.
- [Container Packages](./developer/guides/container-packages.md): builds, validation, immutable versions and publication.
- [Ubuntu Platform Transition](./developer/guides/ubuntu-platform-transition.md): migration, compatibility and rollback evidence.
- [Security Hardening, 2026-11-04](./developer/guides/security-hardening-2026-11-04.md) and [Security Rollout, 2026-11-09](./developer/guides/security-rollout-2026-11-09.md): historical findings and validation.
- [Performance, 2026-11-11](./developer/guides/performance-2026-11-11.md): memory measurements and deployment settings.
- [Open Signup, 2026-11-15](./developer/guides/open-signup-2026-11-15.md): account protection and operational rollout.

## Update Rules

- Update `docs/ai-agent` when work procedures or completion criteria change.
- Update `docs/developer` when module boundaries, runtime flows or main code entry points change.
- Review architecture, installation and operations together when Compose variables or volumes change.
- Review the user guide and troubleshooting together when authentication, mailbox or sending behavior changes.
- Preserve the dates and limits of historical evidence; translating a record does not rerun its tests or renew its security assessment.
