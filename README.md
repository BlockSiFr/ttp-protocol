# Trust Transfer Protocol (TTP)

TTP is an open protocol for runtime trust verification of autonomous systems using signed behavioral evidence and short-lived trust tokens.
It solves the gap between **identity authentication** and **execution-time trustworthiness**.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Spec](https://img.shields.io/badge/spec-v1.0-green.svg)](protocol/spec.md)
[![Status](https://img.shields.io/badge/status-active%20development-orange.svg)](docs/roadmap.md)

---

## If you only read one section

TTP adds a trust check before execution. Issuers publish signed behavioral receipts, a Trust Authority aggregates them into a short-lived trust token, and services verify that token at the moment of action. The decision is scoped, time-bounded, and cryptographically verifiable; if trust requirements are not met, execution is denied or constrained.

---

## What this is / What this is not

### What TTP is

- A protocol for **runtime trust decisions**.
- A receipt and token model for **stateless verification at service boundaries**.
- A way to combine evidence from **multiple independent issuers**.
- A trust-routing model for selecting a valid authority path before execution.

### What TTP is not

- Not a replacement for OAuth/OIDC, IAM, SPIFFE, mTLS, ZTNA, or API gateways.
- Not a generic monitoring dashboard.
- Not a static policy-only system.
- Not a vendor-locked hosted service requirement.

---

## Why this exists

Most security controls answer: **who is calling**.
TTP answers: **should this action run now, given recent behavior**.

Static credentials can remain valid while an agent is compromised, manipulated, or drifting.
TTP addresses that by making trust time-bounded and behavior-derived.

---

## Minimal example (end-to-end)

```text
Agent -> Trust Token -> Service -> Execute or Deny
```

Concrete flow:

1. Agent actions are observed by issuers.
2. Issuers submit signed receipts.
3. Trust Authority computes trust score and issues short-lived token.
4. Service verifies token (signature, freshness, domain, minScore).
5. Service executes or denies.

---

## Core Concept

- Trust is evaluated at execution time, not only at login time.
- Receipts are signed and verifiable.
- Tokens are short-lived and domain-scoped.
- Services verify tokens statelessly.
- Trust can decay and recover based on recent behavior.
- Multi-issuer evidence reduces single-observer bias.

---

## How it works

```text
Agent -> Issuers -> Trust Authority -> Trust Token -> Service Verifier -> Execution
```

Trust flow:

1. Agent performs actions.
2. Independent issuers produce signed behavioral receipts.
3. Trust Authority verifies receipts and computes trust score.
4. Trust Authority issues short-lived trust token.
5. Service verifies token and enforces policy.

---

## Trust Routing subsystem

TTP includes Trust Routing for pre-execution authority-path resolution:

```text
execution request -> route resolution -> authority decision -> execution receipt -> enforcement
```

Key implementation entry points:

- `apps/trust-route-resolver/src/server.mjs`
- `packages/trust-routing-engine/src/*`
- `.github/workflows/trust-routing-governed-steps.yml`

---

## What guarantees you get

- Cryptographic integrity of receipts and tokens.
- Time-bounded trust decisions.
- Domain isolation (trust does not automatically transfer across domains).
- Fail-closed decision model when trust requirements are not met.
- Stateless verification at service boundaries.

See `docs/security.md` for threat analysis and limits.

---

## What you run

Reference components in this repo:

- Protocol + schemas: `protocol/`
- Trust Authority reference: `reference-implementations/trust-authority/`
- Issuer references: `reference-implementations/issuers/`
- Trust-route resolver demo: `apps/trust-route-resolver/`
- Trust-routing engine: `packages/trust-routing-engine/`

---

## What you integrate

Choose by role:

### Agent/runtime team

- Request domain-scoped trust tokens before sensitive actions.
- Pass token to protected downstream service.

### Service/API team

- Verify token per route.
- Enforce domain and minimum score.

### Platform/security team

- Operate Trust Authority.
- Register issuers and agents.
- Set thresholds and governance policy.

---

## Quickstart

### 1) Run Trust Authority reference implementation

```bash
cd reference-implementations/trust-authority
npm install
npm run generate-keys
npm start
```

### 2) Integrate fast via Easy Connect API

- Guide: `docs/easy-connect-api.md`
- Contract: `runtime/api/connect.contract.md`

### 3) Integrate full verification flow

- `docs/integration-guide.md`

---

## GitHub self-governance (runtime authority for repo actions)

- Architecture: `docs/github-self-governance-reference-architecture.md`
- Protected action model: `docs/protected-action-model.md`
- Workflow contract: `docs/protected-gate-workflow-contract.md`

---

## Security, governance, and release readiness

- Security model: `docs/security.md`
- Security policy: `SECURITY.md`
- Contributing: `CONTRIBUTING.md`
- Public readiness checklist: `docs/public-readiness.md`
- Open-source boundary: `docs/open-source-boundary.md`
- Repo access control: `docs/repo-access-control.md`

---

## Related systems (complementary)

- OAuth/OIDC, IAM: identity and static authorization.
- SPIFFE/SPIRE, mTLS: workload identity/channel security.
- ZTNA: network access posture.
- API gateways/service mesh: traffic and connectivity controls.

TTP adds execution-time behavioral trust decisions on top of these layers.

---

## Project status

- Spec: `v1.0` (active development)
- TypeScript SDK: present
- Python/Go SDKs: planned

See `docs/roadmap.md`.

---

## License

Apache License 2.0. See `LICENSE`.

For IP and commercialization boundary details, see `docs/patent-strategy.md` and `docs/open-source-boundary.md`.
