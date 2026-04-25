# SCIM-RE Authorize API (`POST /re/authorize`)

## 1) Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.
- Unknown or unverifiable conditions fail closed (`DENY` or `ESCALATE`).

## 2) Endpoint
`POST /re/authorize`

### Content type
`application/json`

### Authentication
Implementation-defined. In production, use workload identity and signed service-to-service authentication.

## 3) Request contract

### Required fields
- `requestId` (string)
- `action` (string)
- `resource.id` (string)

### Strongly recommended fields
- `subject` or `principal`
- `authorityGrant.grantId`
- `context.environment`
- `context.agentType`
- `context.trustScore`
- `context.dataClassification`
- `attestationRef`

### Request shape
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
    "jurisdiction": "US",
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

## 4) Decision model

### Top-level decision outcomes (exactly one)
- `PERMIT`
- `STEP_UP`
- `ESCALATE`
- `DENY`

### Decision modes
- `FULL`
- `CONSTRAINED`
- `REQUIRES_REATTESTATION`
- `REQUIRES_HUMAN_APPROVAL`
- `FAILED_CLOSED`

Constrained execution MUST be represented as:
- `decision = PERMIT`
- `mode = CONSTRAINED`

## 5) Response contract

### Success response (`200`)
```json
{
  "decision": "STEP_UP",
  "mode": "REQUIRES_REATTESTATION",
  "reasonCodes": ["trust_requires_step_up"],
  "constraintsApplied": ["provide-fresh-attestation"],
  "approvalsRequired": [],
  "trust": { "trustScore": 0.62 },
  "risk": { "riskScore": 0.58, "riskLevel": "HIGH", "blastRadius": "ENVIRONMENT" },
  "cost": { "estimatedCost": 1.02, "budgetDecision": "WITHIN_BUDGET", "costCenter": "platform-security" },
  "compliance": {
    "retentionClass": "STANDARD",
    "frameworkApplicability": [
      { "framework": "NIST", "status": "APPLIES" }
    ]
  },
  "receiptId": "rcpt-abc",
  "receipt": {
    "schemaVersion": "1.0.0",
    "receiptId": "rcpt-abc",
    "issuedAt": "2026-04-25T00:00:00Z",
    "execution": {},
    "decision": { "outcome": "STEP_UP", "mode": "REQUIRES_REATTESTATION" },
    "trust": {},
    "risk": {},
    "cost": {},
    "compliance": {},
    "evidence": {},
    "integrity": { "hashAlgorithm": "SHA-256", "hash": "...", "chainHash": "..." }
  }
}
```

### Error response (`400`)
```json
{
  "error": "invalid_request"
}
```

## 6) Status codes
- `200` — decision returned with receipt
- `400` — invalid request payload
- `404` — endpoint not found
- `5xx` — authority unavailable; callers should fail closed

## 7) Caller enforcement requirements
- Do not execute before receiving response.
- Treat missing `receipt` or `receiptId` as deny.
- Persist `receiptId` with execution logs.
- Respect `mode` and `constraintsApplied` even when `decision=PERMIT`.
- Route `STEP_UP` and `ESCALATE` to explicit re-attestation / human approval paths.

## 8) Compatibility and versioning
- Receipt schema uses `schemaVersion`.
- Clients should ignore unknown response fields for forward compatibility.
- Contract changes should be introduced as additive fields or versioned endpoints.
