# TTP CFAV staging activation | operator handoff

**Status (2026-11-02):** GitHub source and synthetic runtime tests are green. Live governed-execution is still **DENIED** because the independently operated staging authority is not connected. Do not disable the failing check, send credentials through chat, change production, or treat the run as a permit.

## What engineering has already delivered

- [PR #86](https://github.com/BlockSiFr/ttp-protocol/pull/86): Independently fetch GitHub's actual environment approval history and current PR identity. Never accept a requester's `approved: true` declaration as proof.
- [PR #87](https://github.com/BlockSiFr/ttp-protocol/pull/87): Persist one-time STEP_UP redemption on a single host with atomic exclusive creation and fsync.
- [PR #88](https://github.com/BlockSiFr/ttp-protocol/pull/88): Persist every HMAC-signed receipt before answering, validate the receipt chain on service startup, restore prior STEP_UP after orderly restart, and refuse corrupted or concurrent-writer state.
- Synthetic negative/positive tests run in standard GitHub CI; these **are not** a real GitHub environment approval.

## Administrator setup from a mobile browser

**First, use a staging-only host and a private HTTPS endpoint.** The service listens on 127.0.0.1 and needs a trusted TLS-terminating ingress controlled by the operator. A GitHub secret cannot magically create an authority endpoint.

1. In an approved vault on the staging host, provision `RUNTIME_AUTH_TOKEN` and `RECEIPT_HMAC_SECRET` independently, each at least 32 bytes. Provision `GITHUB_APPROVAL_VERIFY_TOKEN` as a separately scoped GitHub App installation token or least-privilege credential that can read Actions workflow-run approval history and PR details.
2. Set `RUNTIME_AUTH_RECEIPT_LEDGER_PATH` to a private absolute path on persistent encrypted storage. Set `RUNTIME_AUTH_REPLAY_LEDGER_DIR` to a separate private absolute directory. Restrict directories to the service OS account (0700 on POSIX); never use a shared temp directory or ephemeral container filesystem.
3. Provision `RUNTIME_AUTH_GRANTS_JSON` **on the staging service**, not in this repository. Use a truly authenticated grant issuance source. For a controlled test the grant must be scoped to the exact subject, repo, action, branch and expiry, with a verified trust timestamp **fresh within 900 seconds** at runtime. An arbitrary JSON trust score is not evidence of production identity or effectiveness.
4. In [GitHub repository Actions secrets settings](https://github.com/BlockSiFr/ttp-protocol/settings/secrets/actions), add only the staging endpoint URL as `RUNTIME_AUTH_URL`, the corresponding caller token as `RUNTIME_AUTH_TOKEN`, and the opaque, scoped grant ID as `RUNTIME_AUTH_GRANT_REF`. Never paste the values into issues or ChatGPT. Verify repository workflow permissions are deliberately limited.
5. In [GitHub Environments settings](https://github.com/BlockSiFr/ttp-protocol/settings/environments), create or inspect **`protected-execution`**. Configure at least one independent required reviewer, disable self-review, and constrain eligible branches. Test whether your GitHub plan supports these protections in this public repository.
6. Trigger a **non-production PR** that changes an ordinary documentation file, observe the initial decision and confirm it is `PERMIT` only when all grant and receipt conditions match. For a second, isolated staging PR touching protected policy, expect `STEP_UP`. The independent reviewer approves in GitHub, the server obtains the approval through GitHub's API, and a **new**, bound `PERMIT` receipt must be issued.
7. Repeat negative controls: missing token; wrong grant; revoked/expired grant; changed PR SHA/paths; self-approval; stale or fake GitHub approvals; replay; corrupt ledger; authority outage. Every negative case must DENY. Record redacted workflow run URL, commit SHA, decision, and receipt IDs without sensitive payloads.

**Repository-side tools cannot read, create, or modify your staging vault or GitHub secrets using the currently connected GitHub integration.** Configuring only the GitHub secrets without the independently operated HTTPS authority and reviewer settings will not complete the run.

## Critical reliability and assurance limits

- The receipt ledger and replay ledger are **single-instance/single-host** safeguards, not multi-node distributed transactions. Crash recovery of an orphaned exclusive lock requires an authorized operator to inspect the signed ledger and remove only the stale lock. Never bypass a corrupted ledger.
- The legacy HMAC service is a **reference** integration; receipts are not independently public-key-verifiable and are not target-side effect proofs. Production requires tenant partitioning, durable shared storage, KMS/HSM custody, independent audit and revocation, and effect verification.
- An approved PR does not authorize executing PR-controlled code in a `pull_request_target` workflow. The workflow deliberately reads metadata only.
- This is a staged demonstration, not an ATO, government certification, IP license clearance, or production deployment.

## Unambiguous acceptance record

**PASS** requires a real safe PERMIT, a real protected STEP_UP followed by an independently documented GitHub review and *fresh* PERMIT, plus the full negative matrix. **BLOCKED** means missing staging authority, credential or reviewer. **FAIL** means an incorrect PERMIT, missing receipt, proof mismatch or unrecoverable ledger error.

Evidence and residual work: [P0 activation issue #80](https://github.com/BlockSiFr/ttp-protocol/issues/80), [independent conformance #82](https://github.com/BlockSiFr/ttp-protocol/issues/82), [patent counsel review #81](https://github.com/BlockSiFr/ttp-protocol/issues/81).
