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

### Changed
- Governed execution workflow hardened to handle:
  - robust changed-file serialization,
  - local fallback receipts in no-op/misconfigured environments,
  - step-up approval satisfaction in enforcement.
- Runtime authority model aligned to compact production prompt:
  - decision outcomes constrained to `PERMIT|STEP_UP|ESCALATE|DENY`,
  - constrained behavior represented with `mode=CONSTRAINED`,
  - receipt upgraded to include `execution`, `decision`, `trust`, `risk`, `cost`, `compliance`, `evidence`, and `integrity` sections.
