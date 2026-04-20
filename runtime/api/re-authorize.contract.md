# Runtime Authority API: `POST /re/authorize`

## Request

```json
{
  "subject": {
    "workload_identity": "wi://ttp/github/runtime-systems",
    "invoking_actor": "github-app:ttp-governance"
  },
  "action": "workflow modification request",
  "resource": "repo:blocksifr/ttp-protocol:.github/workflows/ci.yml",
  "context": {
    "repo": "blocksifr/ttp-protocol",
    "branch": "feature/runtime-gate",
    "paths_touched": [".github/workflows/ci.yml"],
    "workflow_run_id": "123456789",
    "commit_sha": "abc123...",
    "environment": "github-actions"
  },
  "authority_grant": {
    "grant_id": "grant-789",
    "expires_at": "2026-04-17T12:00:00Z"
  },
  "attestation": {
    "attestation_id": "att-456",
    "freshness_s": 120,
    "valid": true
  }
}
```

## Response

```json
{
  "decision": "STEP_UP",
  "constraints": ["require_environment_reviewer", "require_security_owner_approval"],
  "reason_codes": ["PROTECTED_ACTION", "HUMAN_STEP_UP_REQUIRED"],
  "receipt": {
    "receipt_id": "er-123",
    "decision": "STEP_UP",
    "chain_hash": "sha256:...",
    "signature": "ed25519:...",
    "issued_at": "2026-04-17T11:00:00Z"
  }
}
```

## Outcome semantics

- `PERMIT`: execute action in current scope.
- `CONSTRAIN`: execute only under returned constraints.
- `STEP_UP`: pause for required step-up approval.
- `ESCALATE`: route to higher authority chain.
- `DENY`: block execution; receipt still recorded.
