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
  "subject": "agent-42",
  "action": "pipeline.deploy",
  "resource": { "type": "environment", "id": "prod" },
  "context": {
    "environment": "prod",
    "source": "github",
    "riskLevel": "high",
    "agentType": "advanced",
    "trustScore": 0.67,
    "dataClassification": "internal",
    "costCenter": "platform-security"
  },
  "attestationRef": "attest-001",
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
  "mode": "REQUIRES_REATTESTATION",
  "reasonCodes": ["trust_requires_step_up"],
  "constraintsApplied": ["provide-fresh-attestation"],
  "receiptId": "rcpt-abc",
  "receipt": {
    "schemaVersion": "1.0.0",
    "decision": {
      "outcome": "STEP_UP",
      "mode": "REQUIRES_REATTESTATION"
    }
  }
}
```
