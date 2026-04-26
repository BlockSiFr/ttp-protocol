# TTP GitHub Self-Governance Reference Architecture

## 1. Executive Summary

TTP GitHub Self-Governance is a protocol extension that packages trust context for **trust-before-execution** governance of AI role-agents operating in GitHub.

Every meaningful non-human action is gated by a Runtime Authority Gate (`POST /re/authorize`) before execution. The gate computes authority, trust, risk, compliance, and cost in one runtime decision and emits a signed, chain-hashed `ExecutionReceipt`.

This document specifies the architecture, decision model, policy patterns, and implementation path for using TTP to govern TTP's own repository.

## 2. Why This Belongs in TTP

TTP supplies delegated trust, trust routing, and attestation context for autonomous actors. GitHub development workflows are high-impact execution surfaces for non-human identities. Governing repository actions through Runtime Authority using TTP context is a natural extension of protocol scope because:

- identity alone is insufficient for sensitive repo actions,
- policy and trust must be evaluated at execution time,
- governance evidence must be cryptographically auditable.

This is protocol infrastructure, not bot automation.

## 3. Protocol Extension: GitHub Self-Governance

### 3.1 New governed surface

Governed actions include:
- issue and PR interaction actions,
- workflow dispatch and workflow modifications,
- merge/release recommendations and approvals,
- policy and receipt-model modifications.

### 3.2 Runtime Authority Gate

All meaningful actions MUST call:

`POST /re/authorize`

Inputs:
- subject workload identity,
- requested action/resource,
- repo context (branch, paths, commit SHA, workflow run id),
- current trust and attestation state,
- active grants and constraints.

Outputs:
- decision outcome (`PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`) with mode semantics (for constrained execution),
- constraints/step-up requirements,
- signed `ExecutionReceipt`.

## 4. SCIM-RE Resource Mapping for Role-Agents

GitHub Self-Governance uses SCIM-RE authority-plane resources without changing provisioning semantics:

- **WorkloadIdentity**: AI role-agent identity (GitHub App / workflow-bound actor)
- **AuthorityGrant**: time-bounded, trust-conditioned permission envelope
- **Attestation**: freshness/legitimacy proof at action time
- **ExecutionReceipt**: signed decision artifact containing whether action should occur

Mapping intent:
- provisioning plane remains unchanged,
- authority plane performs runtime authorization and evidence capture.

## 5. Runtime Decision Model

Decision tuple:

```
Decision = f(authority, trust, risk, compliance, cost, context, constraints)
```

### Authority
- subject identity validity
- grant validity window
- action-resource compatibility
- branch/path/environment constraints

### Trust
- current trust score
- attestation freshness and validity
- decay curve effect
- anomaly penalties

### Risk
- action criticality
- blast radius
- reversibility
- delegation depth
- protected-path sensitivity

### Compliance
- implicated controls/framework tags
- evidence mode required
- retention tier required
- human oversight requirement

### Cost
- execution cost estimate
- review/escalation cost estimate
- evidence generation/storage cost estimate
- avoided-loss estimate
- control overhead category

### Outcomes
- `PERMIT`
- `CONSTRAIN`
- `STEP_UP`
- `ESCALATE`
- `DENY`

Fail closed on missing/ambiguous signals.

## 6. Risk Framework

Risk classes:

- **Low**: comments/labels/reviews without protected-path effect
- **Medium**: workflow dispatch, merge recommendations, non-protected automation changes
- **High**: policy modifications, workflow file edits, receipt model updates
- **Critical**: merge to main, release tags, core runtime authorization/key path changes

Risk calculation factors:
- action criticality
- blast radius
- reversibility
- delegation chain depth
- anomaly score
- protected file/path impact

## 7. Compliance Framework

Compliance is evaluated in decision-time, not post-processing.

Per-action compliance attributes:
- framework tags (SOC2/ISO27001/internal-control-map)
- control IDs touched
- evidence mode (`required`, `enhanced`, `forensic`)
- retention tier (`standard`, `elevated`, `long_term`)
- human oversight requirement (`none`, `single`, `dual`)

If required compliance controls cannot be satisfied, decision MUST be `ESCALATE` or `DENY`.

## 8. Cost Framework

Cost dimensions at authorization time:
- execution compute/tooling cost
- human review cost (step-up/escalation)
- evidence capture/storage cost
- estimated avoided-loss value
- control overhead class (`light`, `standard`, `heavy`)

Cost does not override hard security/compliance denials. It only informs constrain/escalate policy.

## 9. ExecutionReceipt Extension

Extended receipt fields include:
- identity + trust context
- authority grant basis + policy basis
- risk posture snapshot
- compliance posture snapshot
- cost snapshot
- approval/escalation chain
- signature + chain hash
- GitHub context: repo, branch, paths touched, workflow run id, commit SHA, invoking actor

Reference schema extension: `spec/extensions/execution-receipt-v2.schema.json`.

## 10. GitHub Integration Architecture

### 10.1 Components
- GitHub App (repo-facing execution identity)
- GitHub Actions workers (constrained executors)
- Runtime Authority service (`/re/authorize`)
- Receipt signer/store
- Trust Authority scorer

### 10.2 Control flow
1. Slash command / workflow trigger requests action.
2. Worker assembles authorization request context.
3. Worker calls `POST /re/authorize`.
4. Authority returns outcome + constraints + receipt.
5. Worker enforces result:
   - execute permitted action,
   - constrain scope,
   - request step-up,
   - escalate to human approver,
   - deny.
6. Receipt is persisted and chain-linked.

### 10.3 Guardrails
- agent reasoning is not authority,
- workflows have no standing power,
- authority is short-lived and action-scoped.

## 11. Agent Role Manifests

Source of truth: `agents/manifests/role-agents.yaml`.

The ten role-agents modeled:
1. Protocol Editor Agent
2. Spec & RFC Maintainer Agent
3. Rust Compiler Agent
4. Runtime Systems Agent
5. ZK / Proof Systems Agent
6. Identity / SCIM-RE Architect Agent
7. Security Research Agent
8. Agent Framework Integration Agent
9. Docs / DX Agent
10. Standards / Ecosystem Agent

Each manifest defines purpose, workload identity, allowed/forbidden actions, path scope, protected actions, trust threshold, freshness, risk tier, compliance implications, cost profile, and receipt requirements.

## 12. Protected Actions and Step-Up Policy

Protected actions requiring `STEP_UP` or `ESCALATE`:
- merge to `main`
- release tags
- edits to `.github/workflows/**`
- edits to `policy/**`
- edits to trust model semantics
- edits to receipt schema
- edits to signing/key/verification paths
- edits to core runtime authorization behavior

Policy source: `policy/github-self-governance-policy.yaml`.

## 13. Repo Structure

Proposed self-governance layout:

```
.github/workflows/
agents/
policy/
receipts/
rfcs/
spec/
runtime/
compiler/
docs/
examples/
```

This repository adds initial seeds for:
- `agents/manifests/`
- `policy/`
- `runtime/api/`
- `rfcs/`
- `spec/extensions/`

## 14. Example API Contracts

Normative example contracts are in:
- `runtime/api/re-authorize.contract.md`

Includes request/response schema and outcome mapping.

## 15. Example Workflow Skeletons

Reference workflow:
- `.github/workflows/ttp-governed-pr-action.yml`

Pattern:
1. collect action context,
2. call Runtime Authority,
3. enforce outcome,
4. upload/store receipt metadata.

## 16. Phased Implementation Plan

### Phase 1
- advisory agents only
- comments/reviews/labels
- no merge authority

### Phase 2
- scoped workflow dispatch
- trust decay + attestation checks
- constrained execution mode

### Phase 3
- protected action step-up
- merge/release gating
- receipt-backed approvals

### Phase 4
- public reference implementation
- repository self-governed with TTP policy plane

## 17. Maintainer / Ecosystem Value

Maintainers gain:
- deterministic runtime governance for non-human actions,
- auditable execution evidence,
- reduced ambiguity in sensitive repo operations.

Ecosystem gains:
- concrete reference model for CI/CD governance,
- reusable authority-plane patterns for machine identities,
- practical bridge between protocol semantics and operational tooling.

## 18. Commercial Wedge and Revenue Logic

This is a governance infrastructure wedge, not a bot feature.

Value path:
- starter self-hosted governance,
- enterprise governance controls,
- managed authority service,
- compliance/evidence modules,
- advisory and implementation services.

Commercial offerings remain optional and non-normative; core protocol semantics and interoperability remain open.
