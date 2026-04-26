# BlockSiFr Agent Trust Infrastructure

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![CI / Repository Health](https://github.com/blocksifrdev/ttp-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/blocksifrdev/ttp-protocol/actions/workflows/ci.yml)
[![TTP / Governed Execution Proof](https://github.com/blocksifrdev/ttp-protocol/actions/workflows/governed_execution.yml/badge.svg)](https://github.com/blocksifrdev/ttp-protocol/actions/workflows/governed_execution.yml)

Trust-before-execution infrastructure for enterprise agent, CI/CD, and API control planes.

**Authorship:** Trust Transfer Protocol (TTP) is authored by **Maurice Witten**, Founder & Chief Architect of **BlockSiFr**.

---

## What this repository is for

This repo gives technical teams a complete baseline for runtime authority:
- formal **runtime decision contracts** (SCIM-RE/RAP),
- machine-readable **OpenAPI + JSON Schema** artifacts,
- a runnable **FrontDesk Runtime Authority Gate** reference service,
- SDKs for integration,
- CI checks and examples proving decision + receipt behavior.

If your team needs to enforce “no execution without runtime authorization,” this is the implementation starting point.

---

## Core definitions

- **TTP** = **Trust Expression Layer**
- **SCIM-RE** = **Runtime Execution Governance Protocol**
- **RAP** = **Runtime Authority Protocol**
- **FrontDesk** = **Runtime Authority Gate**

> **Critical boundary:** TTP does not execute or authorize by itself. FrontDesk enforces runtime decisions through SCIM-RE/RAP.

```text
Intent → TTP → SCIM-RE/RAP → FrontDesk → Execution → ExecutionReceipt
```

---

## Open-source vs paid boundary

**Open-source (this repo):** protocol specs, schemas, reference implementations, SDK baselines, conformance/integration examples.

**Commercial (outside this repo):** managed operations, enterprise workflow products, premium connectors, SLA-backed services.

See: [`docs/open-source-boundary.md`](docs/open-source-boundary.md).

---

## Integrate in 15 minutes

1. Start with contracts: [`specs/README.md`](specs/README.md).
2. Run the reference gate: [`reference-implementations/runtime-authority-gate/README.md`](reference-implementations/runtime-authority-gate/README.md).
3. Call `POST /re/authorize` from your app/pipeline using:
   - [`sdk/node`](sdk/node)
   - [`sdk/python`](sdk/python)
4. Enforce decision+mode and persist receipt evidence.

Detailed integration path: [`docs/user-guide.md`](docs/user-guide.md).

---

## Deploy in stages (local → production)

- **Local dev:** single process, memory/file receipt store.
- **Pre-prod:** signed receipts, immutable retention store, policy promotion flow.
- **Production:** hardened caller auth, key management, SLO dashboards, step-up/escalation runbooks.

Deployment guide: [`docs/deployment-guide.md`](docs/deployment-guide.md).

---

## Repository map

- `specs/` — protocol + API contracts.
- `reference-implementations/runtime-authority-gate/` — runnable FrontDesk service.
- `sdk/node`, `sdk/python` — integration SDKs.
- `examples/` — CI/CD and gateway integration patterns.
- `docs/` — user, admin, and deployment guidance.

---

## Verify everything works

```bash
npm test
python -m py_compile sdk/python/client.py
```

---

## Non-goals

This repository does **not** position:
- TTP as a standalone runtime,
- TTP as an independent execution authorizer,
- blockchain as a required runtime dependency.
