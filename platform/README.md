# MailBox Platform Images

`node24/Dockerfile` is the project-specific Ubuntu 26.04 / Node.js 24 fallback. It does not overwrite a shared image tag. The root `docker-bake.hcl` builds it once and provides the same build context to SMTP and Webmail. You can also supply a validated external Ubuntu 26.04 / Node.js 24 base through `NODE_IMAGE`.

The deployment used an ARM64 daemon; standalone builds use the selected builder's architecture unless `PLATFORMS` overrides it. Production Compose uses the `platform` project, `mailbox-*` services and five existing external volumes. Run standalone builds and commands from the checkout root. For data replacement, security evidence, client endpoints and rollback, follow the [transition guide](../docs/developer/guides/ubuntu-platform-transition.md).
