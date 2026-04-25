# Runtime Authority Gate (FrontDesk) - Reference Implementation

Minimal local service implementing runtime authority for governed actions.

## Endpoints
- `GET /healthz`
- `POST /re/authorize`

## Features
- Local trust evaluation (`trustScore` thresholding).
- In-memory `AuthorityGrant` validation.
- `ExecutionReceipt` generation for every decision.
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
