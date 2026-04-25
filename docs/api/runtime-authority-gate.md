# Runtime Authority Gate API

## Canonical artifacts
- OpenAPI: `specs/openapi/runtime-authority-gate.openapi.json`
- Request schema: `specs/schemas/re-authorize-request.schema.json`
- Response schema: `specs/schemas/re-authorize-response.schema.json`
- Receipt schema: `specs/schemas/execution-receipt.schema.json`

## Runtime endpoints
- `GET /healthz`
- `POST /re/authorize`
- `POST /re/reauthorize`
- `POST /utils/binding-hash`
- `GET /receipts`
- `GET /receipts/:id`

## Decision contract
Top-level `decision` outcomes:
- `PERMIT`
- `STEP_UP`
- `ESCALATE`
- `DENY`

Decision `mode` values:
- `FULL`
- `CONSTRAINED`
- `REQUIRES_REATTESTATION`
- `REQUIRES_HUMAN_APPROVAL`
- `FAILED_CLOSED`

RAP projection (`rapDecision`) values:
- `allow`
- `throttle`
- `step_up`
- `escalate`
- `deny`

Every governed execution call must use `POST /re/authorize`, and every response must include an `ExecutionReceipt`.
