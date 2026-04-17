# Runtime Authority API: `POST /re/authorize`

## Request

```json
{
  "subject": "wi://ttp/github/security-review-agent",
  "action": "workflow modification request",
  "resource": "repo:blocksifr/ttp-protocol:.github/workflows/ci.yml",
  "repo": "blocksifr/ttp-protocol",
  "branch": "feature/runtime-gate",
  "pathsTouched": [".github/workflows/ci.yml"],
  "workflowRunId": "123456789",
  "commitSha": "abc123...",
  "invokingActor": "github-app:ttp-governance",
  "authorityGrantRef": "grant-789",
  "attestationRef": "att-456",
  "freshnessSeconds": 120,
  "context": { "environment": "github-actions" }
}
```

## Response

```json
{
  "decision": "STEP_UP",
  "reason": "protected_action_requires_human",
  "receiptId": "er-123"
}
```

## Outcome semantics

- `PERMIT`: execute action in current scope.
- `STEP_UP`: pause for required step-up approval.
- `ESCALATE`: route to higher authority chain.
- `DENY`: block execution; receipt still recorded.

## Re-authorization request (after step-up / escalation approval)

```json
{
  "subject": "wi://ttp/github/security-review-agent",
  "action": "merge request reauthorize",
  "resource": "repo:blocksifr/ttp-protocol:pr/42",
  "repo": "blocksifr/ttp-protocol",
  "branch": "feature/runtime-gate",
  "pathsTouched": [],
  "workflowRunId": "123456789",
  "commitSha": "abc123...",
  "invokingActor": "reviewer:alice",
  "authorityGrantRef": "grant-789",
  "attestationRef": "att-456",
  "freshnessSeconds": 120,
  "priorReceiptId": "er-123",
  "approval": {
    "environment": "protected-action-approval",
    "approved": true,
    "approvedBy": "alice"
  },
  "context": { "event": "pull_request_reauthorize" }
}
```
