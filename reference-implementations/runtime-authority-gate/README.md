# Runtime Authority Gate (FrontDesk) - Reference Implementation

Minimal local service implementing runtime authority for governed actions.

## Endpoints
- `GET /healthz`
- `POST /utils/binding-hash`
- `POST /re/authorize`
- `POST /re/reauthorize`
- `GET /receipts/:id`
- `GET /receipts`

## Features
- Local trust/risk/cost/compliance evaluation.
- Runtime decision outcomes: `PERMIT|STEP_UP|ESCALATE|DENY`.
- Decision modes: `FULL|CONSTRAINED|REQUIRES_REATTESTATION|REQUIRES_HUMAN_APPROVAL|FAILED_CLOSED`.
- `AuthorityGrant` validation.
- Structured `ExecutionReceipt` generation for every decision (`execution`, `decision`, `trust`, `risk`, `cost`, `compliance`, `evidence`, `integrity`).
- `chainHash` linking for tamper-evident local audit chains.
- Receipt signing and verification utility.
- Durable receipt backend abstraction (`memory` or `file`).

## Storage backend configuration
- `RECEIPT_STORE_MODE=memory|file` (default: `memory`)
- `RECEIPT_STORE_FILE=<path>` (default: `.runtime-authority-receipts.json`)

## Signing configuration
- `RECEIPT_SIGNING_MODE=HMAC|RS256` (default: `HMAC`)
- `RECEIPT_HMAC_SECRET=<secret>` (for HMAC)
- `RECEIPT_PRIVATE_KEY_PATH=<pem>` (for RS256 signing)
- `RECEIPT_PUBLIC_KEY_PATH=<pem>` (for RS256 verification)

## Run
```bash
node reference-implementations/runtime-authority-gate/server.mjs
```

Default URL: `http://localhost:8080`

## Verify a receipt signature
```bash
node reference-implementations/runtime-authority-gate/verify-receipt.mjs /path/to/receipt.json
```

## API usage
See canonical contract: `specs/scim-re-authorize-api.md` and `specs/openapi/runtime-authority-gate.openapi.json`.

Quick request:
```bash
curl -sS -X POST http://127.0.0.1:8080/re/authorize \
  -H 'content-type: application/json' \
  -d '{"requestId":"demo-1","action":"pipeline.deploy","resource":{"type":"environment","id":"prod"},"context":{"environment":"prod","trustScore":0.9},"authorityGrant":{"grantId":"grant-local-001"}}' | jq .
```

## Test
```bash
npm run test:runtime-authority-gate
```
