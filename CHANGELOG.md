# Changelog

## 2026-09-15

### Changed — normative

- **Trust score aggregation corrected to v1.1** (`protocol/aggregation-spec.md`). Step 5
  capped a dominant issuer's contribution and then re-normalized across *all* issuers,
  which returned the capped excess to that issuer whenever the others were light: with 50
  receipts from one issuer and one each from two others, the "capped" issuer held 87% of
  the weight and the aggregate was 0.90. The cap only bound when the field was already
  balanced — the case where a cap is unnecessary.

  v1.1 redistributes a capped issuer's excess to the **uncapped** issuers, and applies
  `effective_cap = max(max_issuer_weight, 1 / issuer_count)` since a cap below `1/n`
  cannot be satisfied. The same input now yields 0.40 for the dominant issuer and an
  aggregate of 0.52.

  **This changes conformance.** v1.0 implementations produce different scores wherever one
  issuer exceeds the cap while others are light. Re-run the test vectors.

- **Aggregation test vectors repaired and extended.** `agg-003` contradicted itself — its
  `_explanation` worked the arithmetic and concluded 0.5 while `expected` said 0.4 — and
  was superseded by its own corrected variant, which now carries the `agg-003` id.
  `agg-008` was recomputed from unrounded weights (0.917 → 0.918). `agg-006` is unchanged
  and now passes, having asserted an intent v1.0 could not deliver. Added `agg-009`
  (redistribution), `agg-010` (the `1/n` floor) and `agg-011` (single issuer).

### Added

- First implementation of the normative aggregation algorithm, in
  `packages/pctr/src/aggregate.mjs`, with all eleven vectors running in CI.
- `pctr attest`: trust measured from execution receipts and configured attestors rather
  than read from `pctr.json`, emitting a TTP `TrustThresholdProof`. An agent with no
  admissible evidence is `UNPROVEN` and cannot route to a protected consequence.


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
