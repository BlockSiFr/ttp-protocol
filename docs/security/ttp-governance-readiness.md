# TTP governed execution: deployment acceptance

**Status, November 2, 2026: source hardened, live authorization NOT verified.**

PR #77 merged validated fail-closed changes in the GitHub workflow and the reference authority service. PR #79 added independent Go pinned-key verification and Node-to-Go conformance tests. The normal test CI is passing.

**Verified live blocker:** [workflow run 41544110333](https://github.com/BlockSiFr/ttp-protocol/actions/runs/41544110333) refused authorization because `RUNTIME_AUTH_URL`, `RUNTIME_AUTH_TOKEN`, or `RUNTIME_AUTH_GRANT_REF` was missing. A denied run is evidence of fail-closed behavior, not a proven legitimate permit.

## Current trust model

- `pull_request_target` uses the trusted base branch and does not execute or check out PR-controlled code. Metadata comes from the GitHub API. File inventory must be complete before the request.
- HTTPS `POST /re/authorize` uses a bearer credential. The reference service requires operator-provisioned trust/grant state and refuses a requester's self-asserted trust score as authority.
- Only the exact repository, commit SHA, workflow run ID, action, resource, changed-path list, and applicable grant may be relied upon. The reference authority returns a signed HMAC receipt bound to that evaluation.
- Sensitive policy/workflow changes cannot be direct PERMIT; they require `STEP_UP`.
- After GitHub environment approval, a separate job retrieves the independent reviewer's identity through GitHub's approvals API, reconstructs the PR changed-path inventory and requests a **new** bound reauthorization receipt. The final job requires `PERMIT` with a new receipt ID. Failure at any stage DENIES.
- Source tests cover fail-closed workflow posture, but cannot prove externally configured GitHub reviewers, server identity or live target-side execution.

## Configure in approved staging

1. Deploy the reference authority behind a trusted HTTPS gateway. Supply `RUNTIME_AUTH_TOKEN` and `RECEIPT_HMAC_SECRET` (at least 32 bytes each), plus `RUNTIME_AUTH_GRANTS_JSON` containing independently vetted, current and scoped grants. See [service README](../../services/authority/README.md).
2. Configure GitHub Actions secrets `RUNTIME_AUTH_URL`, `RUNTIME_AUTH_TOKEN` and `RUNTIME_AUTH_GRANT_REF` by an authorized repository administrator. Do not publish values in issues or PRs.
3. Configure a GitHub `protected-execution` Environment with required independent reviewers and disallow self-approval, verifying repository rules and identity.
4. Perform signed positive and negative staging runs including safe PERMIT, protected STEP_UP, post-approval new PERMIT, direct protected PERMIT denial, bad token, unknown/revoked/expired grant, altered commit and path, stale state, replayed receipt, missing approval and service outage.
5. Produce redacted, immutable evidence tied to exact workflow SHA and deployment version. Only then consider requiring the governed-execution check for merges.

## Known limitations

- The starter reference service still holds its receipt ledger in process memory; production-grade persistence, rotation, revocation, key custody, peer identity, audit retention and high availability are external P0 deliverables.
- HMAC receipts are authenticated between parties sharing the key; they are not equivalent to independently pinned Ed25519 verifier receipts.
- GitHub's JSON structural checks depend on an independently trusted runtime endpoint and transport. They do not independently cryptographically validate receipts.
- GitHub approvals API and environment reviewer rules have not passed a real protected-action acceptance run with configured secrets.
- The reference code is **not** an automatic PR merge or deployment authority, a formal security certification, or an authorization to operate.

**Next acceptance:** [P0 staging activation issue #80](https://github.com/BlockSiFr/ttp-protocol/issues/80), [P0 patent legal review #81](https://github.com/BlockSiFr/ttp-protocol/issues/81), and [independent conformance issue #82](https://github.com/BlockSiFr/ttp-protocol/issues/82).