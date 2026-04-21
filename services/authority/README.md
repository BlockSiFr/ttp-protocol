# Authority Service (Starter)

Minimal runtime authority service scaffold for GitHub protected-action governance.

## Endpoints

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
