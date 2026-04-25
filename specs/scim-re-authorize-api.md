# SCIM-RE Authorize API (`POST /re/authorize`)

## 1) Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.
- Unknown or unverifiable conditions fail closed (`DENY` or `ESCALATE`).

## 2) Endpoints
Primary:
- `POST /re/authorize`

RAP-compatible extensions:
- `POST /re/reauthorize`
- `POST /utils/binding-hash`
- `GET /receipts/:id`
- `GET /receipts`

### Content type
`application/json`

### Authentication
Implementation-defined. In production, use workload identity and signed service-to-service authentication.

## 3) Request contract (`POST /re/authorize`)

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

### RAP decision projection (for client compatibility)
| Canonical decision/mode | RAP decision | Next step |
|---|---|---|
| `PERMIT` + `FULL` | `allow` | `execute` |
| `PERMIT` + `CONSTRAINED` | `throttle` | `execute_constrained` |
| `STEP_UP` + `REQUIRES_REATTESTATION` | `step_up` | `reauthorize` |
| `ESCALATE` + `REQUIRES_HUMAN_APPROVAL` | `escalate` | `human_approval` |
| `DENY` + `*` | `deny` | `block` |

## 5) Response contract (`200`)
```json
{
  "decision": "STEP_UP",
  "mode": "REQUIRES_REATTESTATION",
  "reasonCodes": ["trust_requires_step_up"],
  "constraintsApplied": ["provide-fresh-attestation"],
  "approvalsRequired": [],
  "trust": { "trustScore": 0.62, "trustZone": "warning" },
  "risk": { "riskScore": 0.58, "riskLevel": "HIGH", "blastRadius": "ENVIRONMENT" },
  "cost": { "estimatedCost": 1.02, "budgetDecision": "WITHIN_BUDGET", "costCenter": "platform-security" },
  "compliance": {
    "retentionClass": "STANDARD",
    "frameworkApplicability": [
      { "framework": "NIST", "status": "APPLIES" }
    ]
  },
  "rapDecision": "step_up",
  "nextStep": "reauthorize",
  "evaluationTier": "full",
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

## 6) Error responses
### `400`
```json
{ "error": "invalid_request" }
```

### `404`
```json
{ "error": "not_found" }
```

### `404` (`GET /receipts/:id`)
```json
{ "error": "receipt_not_found" }
```

## 7) Status codes
- `200` — decision returned with receipt
- `400` — invalid request payload
- `404` — endpoint or receipt not found
- `5xx` — authority unavailable; callers should fail closed

## 8) Reauthorization contract (`POST /re/reauthorize`)
Used after `STEP_UP` or `ESCALATE` where additional approval/evidence is required.

Request:
```json
{
  "requestId": "reauth-001",
  "priorReceiptId": "rcpt-prior",
  "approval": {
    "approvedBy": "ops-admin",
    "evidenceRef": "ticket-123"
  }
}
```

Response:
- returns the same top-level fields as `POST /re/authorize`
- produces a new receipt chained to prior receipt hash

## 9) Caller enforcement requirements
- Do not execute before receiving response.
- Treat missing `receipt` or `receiptId` as deny.
- Persist `receiptId` with execution logs.
- Respect `mode` and `constraintsApplied` even when `decision=PERMIT`.
- Route `STEP_UP` and `ESCALATE` to explicit re-attestation / human approval paths.

## 10) Compatibility and versioning
- Receipt schema uses `schemaVersion`.
- Clients should ignore unknown response fields for forward compatibility.
- Contract changes should be introduced as additive fields or versioned endpoints.
