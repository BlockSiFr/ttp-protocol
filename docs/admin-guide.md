# Administrator Guide (Security, Compliance, Operations)

## Who this guide is for
Security architects, governance owners, platform administrators, and compliance operators.

## Administrative objective
Run runtime authorization as a non-bypassable control plane with:
- fail-closed execution controls,
- deterministic step-up/escalation handling,
- durable, verifiable receipt evidence.

---

## Control architecture

### Mandatory control points
- Pre-execution authorization (`POST /re/authorize`).
- Enforcement at execution boundaries.
- Receipt persistence and integrity verification.

### Recommended environment topology
- Per-environment FrontDesk (`dev`, `staging`, `prod`).
- Policy set versioning and promotion process.
- Centralized receipt retention with immutable controls.

---

## Governance operations

### Policy governance
Define and version:
- trust thresholds,
- risk triggers,
- budget/quota controls,
- compliance obligations by jurisdiction/classification,
- approver roles for `STEP_UP` and `ESCALATE`.

### Identity and grant hygiene
- Use short-lived authority grants.
- Require explicit scope for secrets and infra mutation.
- Disable standing broad production grants.
- Require workload identity for service-to-service calls.

---

## Step-up and escalation runbooks

### STEP_UP
1. Validate context and attestation freshness.
2. Re-authorize with updated evidence.
3. Preserve evidence references in receipt chain.

### ESCALATE
1. Route to authorized approver role.
2. Capture approver identity + rationale.
3. Re-authorize and verify chained receipt.

---

## Receipt governance

### Minimum retained fields
- `receiptId`
- `execution.executionId`
- `decision.outcome` / `decision.mode`
- `integrity.hash` / `integrity.chainHash`
- `compliance.retentionClass`

### Retention baseline
- `STANDARD`: minimum 12 months.
- `REGULATED` / `FINANCIAL_RECORD` / `PAYMENT_RECORD`: follow framework/legal controls.

---

## Operational KPIs
Track:
- authorization latency (p50/p95),
- decision distribution,
- constrained-permit rate,
- escalation turnaround,
- receipt verification success rate,
- fail-closed deny rate.

---

## Administrator checklist

- [ ] Fail-closed behavior validated per environment.
- [ ] Step-up/escalation paths tested quarterly.
- [ ] Durable receipt storage + verification schedule active.
- [ ] Policy versions/exceptions reviewed monthly.
- [ ] High-risk production mutation requires human approval.

---

## Next step
Use [`docs/deployment-guide.md`](./deployment-guide.md) for production rollout and hardening sequence.
