# Isolated platform validation

These probes run in disposable MailBox fixture containers. They never use production mounts or external DATA. `run-transition.mjs` refuses project/volume names outside the explicit fixture prefix and writes reports only inside the checkout.

Prepare protected random env and a short-lived fixture CA, five separately named `mailbox-ubuntu-fixture-*` volumes and an internal-only network. Use the previous four image IDs for the baseline and mount this directory read-only at `/checks` in Webmail. Establish the service account with the existing API/bootstrap, run `smtp-check.mjs` once to deliver one local fixture message, run `password-check.mjs`, and submit one held local message with `hold-mail.mjs`.

Run `node tests/platform/run-transition.mjs <fixture-compose.json> <candidate-images.json> <report-directory>` with the Docker endpoint/config pinned to the intended test daemon. A separately protected legacy drain helper may be supplied with `LEGACY_DRAIN_SCRIPT`; it is a one-time operator artifact, never production source. The test compares the old/new/old/new state, marks Seen then clears it, verifies concurrent SSR counts, preserves and releases the local hold queue, and checks normal exit0.

`check-images.mjs <task-directory>` verifies four exact archives/OCI/config/scanner identities and Ubuntu26.04/Node24 profiles, failing on HIGH/CRITICAL. Raw remaining severities are recorded rather than hidden.

`ClientConnectionProbe.java` runs in a disposable copy of the real consumer image with its network namespace and read-only CA/credential mounts. For a JRE-only consumer, compile this source with a separately pinned JDK using `javac --release 17 -d <workspace-task-output>`, mount the class directory read-only, and run `java -cp /checks ClientConnectionProbe` in the exact consumer runtime. Success is exit0; the Node operator wrapper serializes audit results. No MAIL/RCPT/DATA is issued.
