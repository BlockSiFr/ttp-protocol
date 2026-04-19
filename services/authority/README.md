# Authority Service (Starter)

Minimal runtime authority service scaffold for GitHub protected-action governance.

## Endpoints

- `POST /v1/connect` (easy integration bootstrap)
- `POST /re/authorize`
- `POST /trust/attest`
- `GET /receipts/{id}`
- `GET /healthz`

## Runtime contract

Input includes: subject, action, resource, repo, branch, pathsTouched, commitSha, invokingActor, workflowRunId, attestationRef, context.

Output includes: decision (`PERMIT|STEP_UP|ESCALATE|DENY`), reasons, constraints, and an `ExecutionReceipt`.

Fail-closed behavior:
- missing grant or invalid attestation => `DENY`
- protected action without step-up evidence => `STEP_UP` or `ESCALATE`

## Easy Connect API (recommended first call)

Use this when integrating a new service/agent with minimal setup.

### Request

```json
{
  "integrationName": "github-protected-merge-gate",
  "subject": "wi://ttp/github/security-review-agent",
  "repo": "blocksifrdev/ttp-protocol",
  "branch": "main"
}
```

### Response

Returns:
- authority URLs (`/healthz`, `/re/authorize`, `/trust/attest`, `/receipts/{id}`)
- a sample `AuthorizeRequest`
- copy/paste curl examples for authorize + attest

This provides a clear, one-call bootstrap for external integrators.
