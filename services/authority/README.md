# TTP Governed Authority (fail-closed reference service)

**Not production accredited.** This is a security-hardened reference integration, not an independently audited identity or execution authority service.

## Required operator configuration

Set these values in a trusted server-side secret store, not in the GitHub repository:

- `RUNTIME_AUTH_TOKEN`: unique bearer credential of at least 32 bytes, shared only with the trusted GitHub workflow; never expose to PR code.
- `RECEIPT_HMAC_SECRET`: independently provisioned signing key of at least 32 bytes. The former development signing fallback has been removed.
- `RUNTIME_AUTH_REPLAY_LEDGER_DIR`: absolute path to an operator-controlled persistent private directory (0700 on POSIX), on a trusted, durable single-node volume. Post-step-up PERMIT is denied if this directory cannot be securely written. The replay file name is a SHA-256 digest of an opaque prior receipt ID. Multi-node transactional deployments require a separate centralized replay ledger and review.
- `GITHUB_APPROVAL_VERIFY_TOKEN`: separate server-side GitHub App installation or fine-grained token with permission to read the repository's workflow-run review history and pull request metadata. The authority verifies approvals directly from GitHub. Never accept an API caller's approval assertion as proof.
- `RUNTIME_AUTH_GRANTS_JSON`: operator-provisioned mapping from opaque grant IDs to `{subject, repo, action, branch?, expiresAt, trustScore, verifiedAt, revoked?}`. Grant state must be obtained from independently authenticated issuer/operator evidence, not request text. `verifiedAt` must be fresh within 900 seconds.
- `PORT`: trusted listener port (default `8080`). The service listens only on `127.0.0.1`, not on a public interface. Terminate TLS and authenticate workload identity with an approved same-host fronting gateway.

An example **synthetic** grant structure, without credentials:

```json
{
  "grant-synthetic-001": {
    "subject": "wi://github/actions/runner",
    "repo": "BlockSiFr/ttp-protocol",
    "action": "pull_request.execute",
    "expiresAt": "2099-01-01T00:00:00Z",
    "trustScore": 0.95,
    "verifiedAt": "MUST_BE_A_TRUSTED_FRESH_TIMESTAMP"
  }
}
```

The workflow additionally requires GitHub Actions secrets `RUNTIME_AUTH_URL`, `RUNTIME_AUTH_TOKEN`, and `RUNTIME_AUTH_GRANT_REF`, and the `protected-execution` environment with independently required reviewers.

## API and security posture

- `POST /re/authorize`: bearer authentication, bounded JSON, scoped grant, exact request binding and fail-closed decision.
- `POST /trust/attest`: reference placeholder, authenticated but **not** an independently validated attestation issuer.
- `GET /receipts/{id}`: authenticated; receipts are process-local and not a production ledger.
- `GET /healthz`: unauthenticated, minimal status only.

Caller-supplied `trustScore`, `freshnessSeconds` or claimed grant IDs never establish trust by themselves. Unknown or stale grants deny or escalate; they do not permit. Step-up reauthorization requires prior receipt continuity, freshness and a **server-side GitHub API read** of the actual `protected-execution` approval, non-author reviewer, and current PR SHA/branch. Without `GITHUB_APPROVAL_VERIFY_TOKEN`, reauthorization is always denied. Atomic, on-disk single-host STEP_UP replay suppression survives process restart; multi-host replay coordination and independent storage audit are still outstanding.

**Remaining P0 integration:** independently verified GitHub/OIDC workload identity, live negative/positive HTTPS tests, durable signed receipt storage, production-grade issuer and revocation registry, KMS/HSM key custody, tenant separation and target-side completion verification. HMAC receipts are not publicly verifiable Ed25519 receipts. Keep this service inaccessible from untrusted networks until those gates are met.

## Local synthetic HTTP acceptance evidence

`node scripts/check-authority-staging.mjs` compiles and starts this service locally with **throwaway, synthetic credentials and grants** and executes a full positive/negative HTTP matrix. GitHub CI runs this by default. This tests service behavior but does **not** authenticate the GitHub Approvals API, validate actual OIDC identity or satisfy any production deployment requirement.

## Staging acceptance distinction

A synthetic GitHub history object can test matching rules, but cannot establish a real reviewer decision. The server only issues post-step-up PERMIT after a successful independent HTTPS request to GitHub. Run [Issue #80](https://github.com/BlockSiFr/ttp-protocol/issues/80) positive and negative cases with an administrator-provisioned verifier token; capture redacted evidence. Do not store any credential in the repository.
