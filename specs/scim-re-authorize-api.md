# SCIM-RE Authorize API (`POST /re/authorize`)

## Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.

## Endpoint
`POST /re/authorize`

## Request
```json
{
  "requestId": "req-123",
  "principal": { "id": "agent-42", "type": "service-agent" },
  "action": "pipeline.deploy",
  "resource": { "type": "environment", "id": "prod" },
  "context": {
    "intent": "release hotfix",
    "riskSignals": ["new_toolchain", "outside_change_window"],
    "trustScore": 0.67
  },
  "authorityGrant": {
    "grantId": "grant-001",
    "expiresAt": "2026-04-25T15:30:00Z",
    "scope": ["pipeline.deploy:prod"]
  }
}
```

## Response
```json
{
  "decision": "STEP_UP",
  "reason": "Trust score below production threshold",
  "constraints": ["require-human-approver"],
  "receipt": {
    "receiptId": "rcpt-abc",
    "chainHash": "9b5...",
    "requestId": "req-123"
  }
}
```
