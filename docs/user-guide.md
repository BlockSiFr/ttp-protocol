# User Guide (Integrators)

## Audience
Application teams, CI/CD owners, platform engineering, and agent-runtime integrators.

## Outcome
By the end of this guide, you should be able to:
1. call `POST /re/authorize` before protected execution,
2. enforce decision + mode correctly,
3. persist `ExecutionReceipt` evidence for audit.

## Quick start (15 minutes)

### Step 1: Run FrontDesk locally
```bash
node reference-implementations/runtime-authority-gate/server.mjs
```

### Step 2: Health check
```bash
curl -sS http://127.0.0.1:8080/healthz | jq .
```

### Step 3: Authorize a governed action
```bash
curl -sS -X POST http://127.0.0.1:8080/re/authorize \
  -H 'content-type: application/json' \
  -d '{
    "requestId":"demo-1",
    "subject":"agent-42",
    "action":"pipeline.deploy",
    "resource":{"type":"environment","id":"prod"},
    "context":{"environment":"prod","agentType":"advanced","trustScore":0.82,"costCenter":"platform"},
    "authorityGrant":{"grantId":"grant-local-001","expiresAt":"2030-01-01T00:00:00Z","scope":["pipeline.deploy:prod"]}
  }' | jq .
```

## Decision enforcement matrix

| Decision | Mode | Caller action |
|---|---|---|
| PERMIT | FULL | Execute as requested. |
| PERMIT | CONSTRAINED | Execute with constraints (reduced scope/capability). |
| STEP_UP | REQUIRES_REATTESTATION | Pause and require fresh attestation/stronger proof. |
| ESCALATE | REQUIRES_HUMAN_APPROVAL | Route to privileged human approval workflow. |
| DENY | FAILED_CLOSED (or other) | Block execution; record receipt. |

## SDK usage
- Node SDK: `sdk/node`
- Python SDK: `sdk/python`

Both SDKs return decision and mode. Integrations MUST evaluate both values.

## Required logging and audit fields
At minimum, store:
- `requestId`
- `decision`
- `mode`
- `receiptId`
- `receipt.integrity.hash`
- `receipt.integrity.chainHash`

## Integration checklist
- [ ] Every protected action calls `POST /re/authorize`.
- [ ] Caller blocks on missing response/receipt.
- [ ] `PERMIT+CONSTRAINED` is handled as constrained, not full permit.
- [ ] `STEP_UP` and `ESCALATE` route to explicit control paths.
- [ ] Receipt IDs are linked to runtime execution logs.

## Troubleshooting
- **400 invalid_request**: verify required fields (`requestId`, `action`, `resource.id`).
- **Unexpected DENY**: validate grant scope/expiry and trust inputs.
- **Frequent ESCALATE in prod**: review risk triggers and mythos/advanced-agent policies.
