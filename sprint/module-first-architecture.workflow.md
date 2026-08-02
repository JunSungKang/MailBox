# Module-first architecture workflow

## S1. Flatten the repository around runtime modules

### S1.1 Promote services to top-level modules

- Move SMTP, IMAP, and Webmail into clearly named repository-root modules.
- Preserve the current service behavior and the user's in-progress Webmail work.
- Remove the tracked packaging, helper-script, and generated-release layers.

### S1.2 Make Compose the system entry point

- Place development and production Compose definitions at the repository root.
- Provide a single safe environment example and update ignore rules.
- Verify that both Compose files resolve only the new module paths.

### S1.3 Align guidance and documentation

- Replace packaging-oriented documentation with architecture, installation, operation, troubleshooting, and user guides.
- Move repository instructions to the root and update their path conventions.
- Remove obsolete reports while retaining the MIT license and governance files.
