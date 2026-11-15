# Container Packages

Update the root `VERSION` and Webmail `package.json`/lock versions together for a release. The project SPDX identifier is `AGPL-3.0-only`; preserve the referenced AGPLv3 text in `LICENSE` unchanged. Images include `NOTICE` and third-party notices. The Webmail footer source link points to the full `SOURCE_REVISION` SHA embedded in the image.

## Public Packages

- `ghcr.io/junsungkang/mail-server-smtp-receiver`
- `ghcr.io/junsungkang/mail-server-imap-mailbox`
- `ghcr.io/junsungkang/mail-server-webmail-ui`

Keep these names compatible with existing registry consumers. Do not delete or overwrite existing version or `sha-<full-SHA>` tags. The current patch release uses `v0.2.1`, `latest` and `sha-<release-source-SHA>`. Only `latest` moves to a new release. Previous visible `v0.1.0`, Webmail `v0.1.1` and November 15 `v0.2.0` digests were preserved during publication. This baseline does not identify or prove restoration of a reported months-old `0.2.0` original.

Each release index contains native `linux/amd64` and `linux/arm64` images. `build-<workflow-run-ID>-<arch>` tags are validated staging images; consumers should use a release tag or digest.

## Build

```bash
docker buildx bake -f docker-bake.hcl --print
docker buildx bake -f docker-bake.hcl
```

SMTP and Webmail share the Node.js 24 target without overwriting another project's shared tag. Bake variables include `TAG`, `VERSION`, `SOURCE_REVISION`, `PLATFORMS` and `NODE_IMAGE`. External bases must still provide Ubuntu 26.04, Node.js 24 and the required native crypto support.

Module Dockerfiles require the `license_files` named context. Root `.dockerignore` excludes everything except `LICENSE` and `NOTICE`, keeping `.env`, mail, accounts, certificates, Git and task artifacts out of this context. All three Compose models provide the same additional context. For direct Dockerfile builds, pass `--build-context license_files=.` from the project root.

Set a distributable build's `SOURCE_REVISION` to the exact public 40-character source commit. Missing or invalid development revisions link to the main archive. When operating a modified public server, publish the corresponding modified source and build with its SHA.

## Validation

Create the validation directory inside the checkout and set `CHECK_DIR`. Set `TAG` to the local image tag and `EXPECTED_ARCHITECTURE` to `amd64` or `arm64`. After building images with those settings, run:

```bash
node tests/release/check.mjs
node tests/release/check.mjs --images
node tests/release/unit.mjs
node tests/release/smoke.mjs
node tests/release/scan.mjs
```

Checks cover versions, SPDX, license-text hash, image OCI labels and embedded LICENSE, native runtime/features, unit tests, and an SMTP/IMAP/Webmail fixture on a separate internal network. They verify service-ID reservation, rejection of forged forwarded headers, signup without codes, password compatibility, TLS/CA/hostname/SASL, one actual Maildir delivery and message content, IMAP count/UID/read state, Webmail import/body display, source links and normal restart. Never select production accounts/volumes or send mail to real external recipients. Remove exactly the fixture-created containers, volumes, networks and credentials afterward.

Trivy uses a digest-pinned scanner and a current database. Do not hide severities or unfixed findings. Verify the archive-to-manifest-to-config-to-scan binding; any HIGH/CRITICAL finding stops publication. Record remaining severities in raw reports. The scanner supports OCI and Docker archives and both native architectures.

## Publication Flow

1. Human feature PR, independent App current-head approval and required checks, then integration into develop.
2. Separate release PR preserving main ancestry, the same approval/check gates, then main merge and exact feature-branch cleanup.
3. A main change to `VERSION`/the publication workflow, or manual dispatch on main, starts `Publish containers`. There is no arbitrary source-ref input or fork/PR publication path.
4. Both native runners build the same SHA, complete tests/scans, and publish architecture-specific staging tags.
5. Assembly requires both jobs to succeed. Verify both architectures, revision, license and version for every package before creating version/SHA indexes; verify all three indexes before moving `latest`.

Buildx is pinned to v0.39.0 and assembles the appropriate Docker/OCI format. Do not add unsupported index annotations to Docker manifest lists. Verified config labels retain source/license/version/revision. A digest-addressed response must match both the body hash and requested digest.

GHCR may acknowledge a push before public manifest/config reads or an updated tag become visible. Post-publication reads retry missing root/architecture manifests/configs and intended tag convergence at most 13 times, five seconds apart. Stop if visibility does not converge or if authentication/hash/source/license validation fails. Do not apply this retry policy to the preflight check for existing immutable tags.

Serialize publication and recheck the current main SHA before writing so stale runs cannot replace current tags. Reject a different existing version/SHA root index; never rewrite an existing immutable tag. A missing paired tag may be copied only from the verified existing digest. Increment the version for a different source release. Three registry names are not updated in one transaction; final verification of all three digests in `published.json` defines completion.

Human GitHub authentication owns commit/push/PR/merge; the App performs formal review. Registry publication uses the workflow's short-lived `GITHUB_TOKEN` with only `contents: read` and `packages: write`. Never put PATs or App private keys in the repository, logs or command arguments. Do not persist checkout credentials; upload only designated report directories as validation artifacts.

An existing package may reject pushes until it grants this repository Actions write access. Verify the actual permission error and configure the package's Actions access. Do not bypass it with another repository or package name.

Verify the final three digests, source SHA, version, SPDX and both architectures in workflow `published.json` and public GHCR manifests/configs. Package publication does not automatically replace operating containers. Follow the separate [operating procedure](operation.md) for deployment with real data.

## Git Tags and GitHub Releases

Use a unique `v<major>.<minor>.<patch>` Git tag and GitHub Release for a published source version. The Git tag must resolve to the exact source revision embedded in that version's images, not whichever main commit happens to be current. A later documentation-only commit may exist on main without changing already published images. Never move an existing release tag or rebuild different source under the same image version. Use a new patch version for a subsequent fix, a minor version for compatible new functionality, and document any breaking change explicitly while the project remains pre-1.0.

Release notes must be in English and state changes, exact source SHA, container references/digests, supported architectures, validation evidence, remaining known issues and upgrade/rollback guidance. Keep image publication, Git tags, GitHub Releases and actual production deployment distinct. Do not claim an unidentified historical image was restored. If a tag or release already exists with conflicting source/content, stop and investigate rather than overwriting it.

Official references: [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html), [SPDX AGPL-3.0-only](https://spdx.org/licenses/AGPL-3.0-only.html), [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [Bake named contexts](https://docs.docker.com/build/bake/contexts/).
