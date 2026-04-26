# Runtime Authority Gate (FrontDesk) — Reference Implementation

A runnable local Runtime Authority service for trust-before-execution enforcement.

## Why this exists

This service demonstrates the minimum operational path for governed execution:
1. evaluate authority/trust/risk/cost/compliance before action,
2. return a deterministic decision+mode,
3. emit an `ExecutionReceipt` for every decision,
4. support step-up/reauthorization flows.

---

## API surface

- `GET /healthz`
- `POST /utils/binding-hash`
- `POST /re/authorize`
- `POST /re/reauthorize`
- `GET /receipts/:id`
- `GET /receipts`

Canonical contract references:
- `specs/scim-re-authorize-api.md`
- `specs/openapi/runtime-authority-gate.openapi.json`

---

## Decision model

Top-level outcomes:
- `PERMIT`
- `STEP_UP`
- `ESCALATE`
- `DENY`

Modes:
- `FULL`
- `CONSTRAINED`
- `REQUIRES_REATTESTATION`
- `REQUIRES_HUMAN_APPROVAL`
- `FAILED_CLOSED`

---

## Quickstart

```bash
node reference-implementations/runtime-authority-gate/server.mjs
```

Health:
```bash
curl -sS http://127.0.0.1:8080/healthz | jq .
```

Authorize:
```bash
curl -sS -X POST http://127.0.0.1:8080/re/authorize \
  -H 'content-type: application/json' \
  -d '{"requestId":"demo-1","action":"pipeline.deploy","resource":{"type":"environment","id":"prod"},"context":{"environment":"prod","trustScore":0.9},"authorityGrant":{"grantId":"grant-local-001"}}' | jq .
```

---

## Configuration

### Storage backend
- `RECEIPT_STORE_MODE=memory|file` (default: `memory`)
- `RECEIPT_STORE_FILE=<path>` (default: `.runtime-authority-receipts.json`)

### Signing
- `RECEIPT_SIGNING_MODE=HMAC|RS256` (default: `HMAC`)
- `RECEIPT_HMAC_SECRET=<secret>`
- `RECEIPT_PRIVATE_KEY_PATH=<pem>`
- `RECEIPT_PUBLIC_KEY_PATH=<pem>`

### Port
- `PORT` (default: `8080`)

---

## Receipt verification

```bash
node reference-implementations/runtime-authority-gate/verify-receipt.mjs /path/to/receipt.json
```

---

## Tests

```bash
npm run test:runtime-authority-gate
```

The test suite validates decision branches (`PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`), reauthorization chaining, and durable file mode behavior.
