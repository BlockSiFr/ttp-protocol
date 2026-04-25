# Administrator Guide (Security, Compliance, Operations)

## Audience
Security architects, platform admins, governance owners, and audit/compliance teams.

## Administrative objective
Operate runtime authorization as a non-bypassable control plane with deterministic approvals, evidentiary receipts, and fail-closed behavior.

## 1) Control architecture

### Mandatory control points
- pre-execution authorization (`POST /re/authorize`)
- decision enforcement at runtime boundaries
- receipt persistence and integrity validation

### Recommended deployment model
- FrontDesk deployed per environment (`dev`, `staging`, `prod`)
- policy set versioning and promotion process
- centralized receipt retention with immutable storage controls

## 2) Policy governance

Define and version:
- trust thresholds
- risk thresholds and critical triggers
- budget and quota policies
- compliance obligations by classification/jurisdiction
- approver roles for `STEP_UP` and `ESCALATE`

## 3) Grant and identity hygiene
- enforce short-lived authority grants
- require explicit scope for secrets and infra mutation
- disable standing broad production grants
- use workload identity for service-to-service authorization

## 4) Step-up and escalation operations

### STEP_UP runbook
1. Validate request context and attestation freshness.
2. Re-run authorization with updated evidence.
3. Record all evidence links in receipt trails.

### ESCALATE runbook
1. Route to authorized approver role.
2. Capture decision rationale and approver identity.
3. Re-authorize with approval context.

## 5) Receipt governance and retention

### Minimum retained fields
- `receiptId`
- `execution.executionId`
- `decision.outcome`, `decision.mode`
- `integrity.hash`, `integrity.chainHash`
- `compliance.retentionClass`

### Retention recommendation
- `STANDARD`: 12 months minimum
- `REGULATED` / `FINANCIAL_RECORD` / `PAYMENT_RECORD`: follow legal & framework-specific controls

## 6) Compliance mapping readiness

Use structured mappings for NIST, FFIEC, SOX, PCI_DSS, CMMC, SOC2, ISO27001, EU_AI_ACT. Mark uncertain applicability as conditional and track residual gaps explicitly.

## 7) Operational KPIs
Track:
- authorization latency (p50/p95)
- decision distribution (`PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`)
- constrained-permit rate
- escalation turnaround time
- receipt integrity verification success rate

## 8) Administration checklist
- [ ] Fail-closed behavior verified in each environment.
- [ ] Approval paths tested quarterly.
- [ ] Receipt retention and integrity verification scheduled.
- [ ] Policy versions and exceptions reviewed monthly.
- [ ] High-risk production mutation paths require human approval.
