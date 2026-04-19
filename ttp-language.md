# TTP Language and Semantics (v1.0)

This document defines the **practical language of TTP** as implemented in this repository: claims, fields, API contracts, and policy semantics.

> Clarification: TTP in this repo is a **protocol + runtime verification model**, not a standalone programming language/compiler.

---

## 1) Scope

TTP expresses trust through three core artifacts:

1. **Behavioral Receipts** (signed evidence from issuers)
2. **Trust Tokens** (short-lived JWTs from Trust Authority)
3. **Verification Policies** (service-side checks at execution time)

---

## 2) Receipt Semantics

A behavioral receipt communicates: who observed what behavior, in which domain, at what time, with what score.

Canonical fields:

- `ttp_version`
- `receipt_id`
- `agent_id`
- `issuer_id`
- `event_type`
- `event_data`
- `domain`
- `timestamp`
- `score` (0.0–1.0)
- `signature`

Normative schema: `protocol/schemas/receipt.schema.json`.

---

## 3) Trust Token Semantics

A trust token is a short-lived JWT representing current behavioral trust for an agent in a domain.

Core claims:

- `sub` (agent identity)
- `ttp_domain`
- `ttp_score`
- `ttp_issuer_count`
- `iat` / `exp`
- `jti`

Normative schema: `protocol/schemas/trust-token.schema.json`.

---

## 4) Policy Evaluation Language (Verifier Side)

TTP policy evaluation is deterministic and typically checks:

1. Signature validity
2. Token freshness (`iat`, `exp`, skew)
3. Domain match
4. Minimum trust threshold (`minScore`)
5. Optional issuer diversity constraints
6. Optional replay checks (`jti`)

In AGT/OPA ecosystems, verified token claims can be mapped into policy input (e.g. `input.ttp`).

---

## 5) Trust Domain Language

Domains are explicit trust boundaries (e.g. `retention`, `prod-change`, `financial`).

Rules of use:

- Trust is domain-scoped.
- Domain trust should not be reused across unrelated action classes by default.
- Score thresholds should be documented by domain risk level.

---

## 6) Operator Semantics

The Trust Authority reference implementation includes admin semantics for lifecycle control:

- agent registration
- issuer registration
- status inspection
- quarantine / lift quarantine
- block
- trust provisioning
- agent registry listing (`GET /v1/admin/agents` with optional metrics)

These semantics support operational trust governance without changing core protocol fields.

---

## 7) Platform Alignment Checklist

This document is considered aligned when the following remain true:

- receipt field names/types match `protocol/schemas/receipt.schema.json`
- trust token claims match `protocol/schemas/trust-token.schema.json`
- trust authority admin semantics reflect implemented routes in `reference-implementations/trust-authority/src/routes.ts`
- verifier guidance aligns with current SDK verification behavior and integration docs
- security assumptions here do not conflict with `docs/security.md`

---

## 8) What TTP Language Is Not (in this repo)

Not currently part of the implemented protocol surface:

- custom DSL compiler/runtime
- on-chain smart-contract execution model
- built-in zero-knowledge proof VM

Those can be explored as future ecosystem extensions, but are not v1 protocol requirements.

---

## 9) Versioning and Compatibility

- `ttp_version` gates protocol interpretation.
- Field semantics are backward-compatible within major version unless otherwise documented.
- New optional claims/fields must not break existing verifiers.

---

## 10) Reference Pointers

- Protocol spec: `protocol/spec.md`
- Aggregation algorithm: `protocol/aggregation-spec.md`
- Integration details: `docs/integration-guide.md`
- Security model: `docs/security.md`
- Public launch checklist: `docs/public-readiness.md`
