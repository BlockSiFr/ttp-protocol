# User Guide (Integrators)

## Who this guide is for
Application teams, platform engineers, CI/CD owners, and agent-runtime integrators.

## What you get from integration
- A single runtime authority API (`POST /re/authorize`) before execution.
- Deterministic decision handling (`PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`).
- Portable execution receipts for audit and investigations.

---

## Integration sequence (recommended)

1. Read the API contract:
   - `specs/scim-re-authorize-api.md`
   - `specs/openapi/runtime-authority-gate.openapi.json`
2. Run local legacy FrontDesk:
   - `reference-implementations/runtime-authority-gate/server.mjs`
3. Integrate SDK calls from `sdk/node` or `sdk/python`.
4. Enforce decision+mode at the caller boundary.
5. Persist receipt metadata with your execution logs.

---

## Quick start (local)

### 1) Start legacy FrontDesk
```bash
node reference-implementations/runtime-authority-gate/server.mjs
```

### 2) Health check
```bash
curl -sS http://127.0.0.1:8080/healthz | jq .
```

### 3) Authorize a governed action
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

---

## Decision enforcement matrix

| Decision | Mode | Caller action |
|---|---|---|
| PERMIT | FULL | Execute requested action. |
| PERMIT | CONSTRAINED | Execute with constraints. |
| STEP_UP | REQUIRES_REATTESTATION | Pause and gather stronger proof/attestation. |
| ESCALATE | REQUIRES_HUMAN_APPROVAL | Route to human approval workflow. |
| DENY | FAILED_CLOSED (or other) | Block execution and retain receipt evidence. |

---

## Required logging/audit fields

At minimum:
- `requestId`
- `decision`
- `mode`
- `receiptId`
- `receipt.integrity.hash`
- `receipt.integrity.chainHash`

---

## Integration checklist

- [ ] Every protected action calls `POST /re/authorize`.
- [ ] Missing response/receipt is treated as deny.
- [ ] `PERMIT+CONSTRAINED` is enforced as constrained.
- [ ] `STEP_UP` and `ESCALATE` map to explicit control flows.
- [ ] Receipt IDs are trace-linked to runtime execution logs.

---

## Next step
For deployment and operational rollout, use [`docs/deployment-guide.md`](./deployment-guide.md).
