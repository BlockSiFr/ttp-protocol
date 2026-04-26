# Changelog

## 2026-04-25

### Added
- BlockSiFr Agent Trust Infrastructure repository baseline:
  - Root positioning README and protocol definitions (TTP, SCIM-RE, RAP, FrontDesk).
  - `specs/` for trust-before-execution and runtime authority contracts.
  - Node and Python SDKs for `POST /re/authorize`.
  - Reference implementation: `runtime-authority-gate` with `ExecutionReceipt` and chainHash linkage.
  - Example integrations for GitHub Actions, Azure DevOps, API gateway, and Copilot tool-call gating.
- Runtime authority contract test (`reference-implementations/runtime-authority-gate/server.test.mjs`).
- CI workflow (`.github/workflows/ci.yml`) covering tests, Python SDK compile check, and end-to-end smoke checks.

- OpenAPI 3.1 contract artifact for Runtime Authority Gate (`specs/openapi/runtime-authority-gate.openapi.json`).
- JSON Schemas and request/response examples for `POST /re/authorize` and `ExecutionReceipt` (`specs/schemas/*`, `specs/examples/*`).
- Contract validation script integrated into test pipeline (`tools/validate-contracts.mjs`, `npm run test:contracts`).
- Receipt signing + verification utilities with HMAC default and optional RS256 key paths (`signing.mjs`, `verify-receipt.mjs`).
- Durable receipt storage abstraction with `memory` and `file` backends (`storage.mjs`).
- CI smoke matrix expanded to assert `PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`, and reauthorization path.

### Changed
- Refactored repository positioning to make TTP protocol boundaries explicit (TTP vs SCIM-RE vs Runtime Authority vs FrontDesk).
- Documentation overhaul for technical clarity: root value proposition, integration/deployment paths, SDK guides, examples map, and runtime gate operational README.
- Governed execution workflow hardened to handle:
  - robust changed-file serialization,
  - local fallback receipts in no-op/misconfigured environments,
  - step-up approval satisfaction in enforcement.
- Runtime authority model aligned to compact production prompt:
  - decision outcomes constrained to `PERMIT|STEP_UP|ESCALATE|DENY`,
  - constrained behavior represented with `mode=CONSTRAINED`,
  - receipt upgraded to include `execution`, `decision`, `trust`, `risk`, `cost`, `compliance`, `evidence`, and `integrity` sections.

- Clarified open-source versus commercial boundary in root README with link to `docs/open-source-boundary.md`.
