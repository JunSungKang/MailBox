# Contributing to MailBox

Bug fixes, tests, documentation and feature proposals are welcome. MailBox is licensed under [AGPL-3.0-only](LICENSE). Submit only work you have the right to contribute, and preserve the licenses and attribution of third-party code.

## Before a change

1. Check existing issues and the [architecture](docs/developer/architecture/system-architecture.md).
2. Read [AGENTS.md](AGENTS.md) and the [development rules](docs/ai-agent/development-rules.md).
3. Work on a feature branch, change only the relevant modules, and preserve existing user changes and operational files.

## Validation

For Webmail changes, run `npm ci`, `npm test` and `npm run build` on Node.js 24. For image or configuration changes, validate Bake and Compose configuration and run the relevant isolated fixtures. The [container guide](docs/developer/guides/container-packages.md) describes validation commands and the release process.

Tests must use separate accounts, Maildirs, queues, volumes and networks, and send mail only to local fixtures. Never include real messages, passwords, tokens, private keys or runtime data in source or validation attachments. Feature logs must follow the existing JSON Lines schema and exclude secrets and message bodies.

## Pull requests

Describe the problem, resulting behavior, related issues, validation results, and data or compatibility impact. Check documentation links and configuration examples, and explicitly identify checks that were not run. Write documentation, PR descriptions and release notes in English.

The integration branch is `develop`; the release branch is `main`. Merges require a human-authored PR, an independent GitHub App review of the current head, and the required checks. Remove the merged feature branch from both the remote and the local repository. External contributors work in their own forks; maintainers perform the repository's guarded integration and release process.
