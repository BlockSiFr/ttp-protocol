# TTP governed execution — integration readiness

Status: **security patch staged, NOT production verified** (2026-10-26).

## Source change
- `.github/workflows/governed-execution.yml`: PR file inventory comes from GitHub API, not PR-controlled checkout; untrusted event fields are parsed as data; missing or failing runtime authority is a hard deny.
- `.github/workflows/ci.yml`: pinned action SHAs, read-only repository token permissions.
- `pull_request_target` is intentionally privileged. Never execute code from a PR in this workflow.

## Authority contract required before enablement
The runtime must expose HTTPS `POST /re/authorize`, authenticate the caller (reject invalid bearer tokens), and produce a decision `PERMIT`, `STEP_UP`, or `DENY` with a receipt whose `receiptId`, `decision`, `repo`, `commitSha`, `workflowRunId`, `action`, `resource`, and `pathsTouched` exactly match the request. Authenticity and integrity of the receipt must be validated by a **trusted authority**. GitHub-side JSON structural checks alone do not validate the cryptographic signature. The authority must independently authenticate/verify GitHub identity and evidence; never accept untrusted `trustScore`, `freshnessSeconds`, `approval`, or grant assertions as proof.

### Known integration blockers
1. `services/authority/index.ts` does not authenticate the incoming bearer token and `receiptSigner.ts` defaults to `dev-only-secret`. The service stores receipts in process memory.
2. The changed workflow does **not** send `authorityGrantRef` or verified attestation evidence. The existing `services/authority/index.ts` therefore normally denies the request. Do not forge a grant or trust score just to get a green check.
3. The separate `reference-implementations/runtime-authority-gate/server.mjs` uses a seeded development grant and its receipt format differs; it is not an interchangeable production gateway.
4. `STEP_UP` presently gates on GitHub environment approval, but there is no post-approval reauthorization with a new bound receipt. Implement and test reauthorization before treating this as a final protected-action authorization protocol.
5. Actual GitHub secret names/values, environment reviewer rules, active deployment, and branch protection could not be verified through source inspection.

## Required configuration
- Configure repository action secrets `RUNTIME_AUTH_URL` (HTTPS) and `RUNTIME_AUTH_TOKEN` (unique credential for this workflow only). Do not commit either value.
- Create `protected-execution` GitHub Environment with **required reviewers**, disallow self-approval where supported, and limit authorized approvers.
- Restrict GitHub workflow permissions; configure protected branch checks when end-to-end results are passing.

## Validation matrix before merging/enabling
1. Unauthorized or absent token => HTTP 401/403 and workflow DENY.
2. No configured endpoint, timeout, malformed response, no receipt, response binding mismatch => DENY.
3. Proven authorized safe PR => signed `PERMIT` receipt bound to exact repository/commit/paths/run.
4. Protected policy/workflow changes => `STEP_UP` and required independent reviewer approval.
5. After approval, independently verified new signed reauthorization receipt => final `PERMIT` (not yet implemented).
6. Forged branch/filename, missing file pages, forked PR, stale or replayed receipts => DENY.
7. Verify receipt signatures, timestamp TTL, trusted issuer, nonce and audience; reject replay.
8. Verify tests in a non-production GitHub environment before enabling as a required merge check.

## Mock validation
A separate isolated local test harness executed 15 branch/outcome checks with simulated GitHub API and simulated authority responses. Results: 15/15 PASS. **It cannot verify an actual deployment, authentication, or cryptographic receipts.**

## Merge guard
Do not claim this PR deploys or activates runtime authority. It stages a fail-closed caller. A separate runtime-authentication/attestation/receipt verification integration is required.
