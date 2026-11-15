# MailBox Agent Development Rules

Last updated: 2026-11-15

## Required Pre-Work

1. Check `git status --short`, the current branch and canonical `origin`.
2. Read `docs/ai-agent/README.md`, `docs/ai-agent/architecture-contract.md` and the task-specific developer documentation.
3. Use `rg` to locate the existing code and tests responsible for the change.
4. Do not delete or overwrite existing user changes or ignored operational files.
5. Use repository governance and local ignored `sprint/` contracts for tracked GitHub writes.

## Implementation Rules

- Each top-level module owns its Dockerfiles and configuration.
- Root Compose owns service networks, ports, volumes and environment-variable assembly.
- Webmail routes belong in `webmail-ui/src/app`; reusable UI in `src/components` and `src/features`; Next-only composition in `src/server`. Native services, policies, repositories, ingestion and HTTP adapters belong in `webmail-ui/backend`; `server.mjs` owns startup and graceful shutdown. Keep compatibility exports at documented runtime paths until their consumers migrate.
- Apply the same signed-session and ownership checks to per-user lists, details, attachments and sending.
- Never start production with a placeholder `WEBMAIL_SESSION_SECRET`. Signup is public with a user ID and password; no signup code is required. Do not bypass reserved SMTP service/recipient IDs or legacy account ownership verification.

## Audit Log Rules

- Use `INFO`, `WARN` and `ERROR` JSON Lines.
- Include `time`, `level`, `event`, `requestId`, `actor`, `ip`, `userAgent`, `method`, `path`, `durationMs` and `status` wherever available.
- Use dotted domain/action event names such as `mail.send.success` and `auth.login.invalid_credentials`.
- Never log message bodies, attachment contents, passwords, cookies, session secrets, signup codes or complete authentication headers.

## Validation Requirements

Check links and paths even for documentation-only changes.

```bash
rg -n 'docs/' README.md AGENTS.md docs
git diff --check
```

For Webmail changes, run:

```bash
npm test --prefix webmail-ui
npm run build --prefix webmail-ui
```

For Compose changes, run these commands where the Docker CLI is available:

```bash
docker compose --env-file .env.example config
docker compose --env-file .env.example -f docker-compose.prod.yml config
```

If the Docker CLI is unavailable, validate YAML syntax, expected services and volumes, and build-context existence instead, and state the unexecuted checks in the PR. The current platform model has four services and five volumes; do not rely on the counts of an older model.

## Documentation Requirements

- Write all repository documentation, README files and release notes in English. Keep filenames, identifiers and runtime contracts intact. Translating documentation does not require changing the UI language.
- Update `docs/ai-agent` when procedures or invariants change.
- Update developer onboarding and architecture when module responsibilities or data flow change.
- Update installation and operations when commands or environment variables change.
- Update the user guide and troubleshooting when user-facing behavior or constraints change.
- Preserve the original date, image binding, measurements and limitations of historical validation records. Do not present translated historical checks as a new test or security scan.
