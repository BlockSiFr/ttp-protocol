# Runtime Authority Gate (FrontDesk) - Reference Implementation

Minimal local service implementing runtime authority for governed actions.

## Endpoints
- `GET /healthz`
- `POST /re/authorize`

## Features
- Local trust/risk/cost/compliance evaluation.
- Runtime decision outcomes: `PERMIT|STEP_UP|ESCALATE|DENY`.
- Decision modes: `FULL|CONSTRAINED|REQUIRES_REATTESTATION|REQUIRES_HUMAN_APPROVAL|FAILED_CLOSED`.
- In-memory `AuthorityGrant` validation.
- Structured `ExecutionReceipt` generation for every decision (`execution`, `decision`, `trust`, `risk`, `cost`, `compliance`, `evidence`, `integrity`).
- `chainHash` linking for tamper-evident local audit chains.

## Run
```bash
node server.mjs
```

Default URL: `http://localhost:8080`

## API usage
See canonical contract: `specs/scim-re-authorize-api.md`.

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
