# Runtime Authority Gate (FrontDesk) - Reference Implementation

Minimal local service implementing runtime authority for governed actions.

## Endpoints
- `GET /healthz`
- `POST /re/authorize`

## Features
- Local trust evaluation (`trustScore` thresholding).
- Runtime decision outcome model: `PERMIT|STEP_UP|ESCALATE|DENY`.
- Runtime decision mode model: `FULL|CONSTRAINED|REQUIRES_REATTESTATION|REQUIRES_HUMAN_APPROVAL|FAILED_CLOSED`.
- In-memory `AuthorityGrant` validation.
- Structured `ExecutionReceipt` generation for every decision (`trust`, `risk`, `cost`, `compliance`, `integrity`).
- `chainHash` linking for tamper-evident local audit chain.

## Run
```bash
node server.mjs
```

Default URL: `http://localhost:8080`

## Test
```bash
npm run test:runtime-authority-gate
```
