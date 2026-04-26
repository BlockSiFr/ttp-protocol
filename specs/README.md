# Specifications

This folder is the protocol and contract source-of-truth for runtime authority integration.

## Recommended reading order

1. `ttp.md` — trust expression scope and boundaries.
2. `scim-re.md` — runtime execution governance semantics.
3. `rap.md` — runtime authority protocol semantics.
4. `scim-re-authorize-api.md` — endpoint and caller enforcement contract.
5. `execution-receipt.md` — receipt evidence model.

## Machine-readable artifacts

- OpenAPI: `openapi/runtime-authority-gate.openapi.json`
- Schemas:
  - `schemas/re-authorize-request.schema.json`
  - `schemas/re-authorize-response.schema.json`
  - `schemas/execution-receipt.schema.json`
- Contract examples:
  - `examples/re-authorize.request.json`
  - `examples/re-authorize.response.json`

## Integration rule
Every governed action must call `POST /re/authorize` and every decision must produce an `ExecutionReceipt`.
