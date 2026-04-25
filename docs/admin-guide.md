# Administrator Guide (Security, Compliance, Operations)

## Who this is for

This guide is for governance owners responsible for policy, approvals, controls, and audit readiness.

## Governance model

The runtime authority layer evaluates:

- authority grant validity
- trust posture
- risk posture
- cost governance
- compliance obligations

Default control behavior is fail-closed when evidence is missing or uncertain.

## Operational responsibilities

### 1) Policy ownership
- Maintain policy set versions and approval requirements.
- Define trust/risk/cost/compliance thresholds by environment.

### 2) Identity and grant hygiene
- Rotate and expire authority grants.
- Disallow standing broad grants in production.
- Require explicit grants for secrets access and infrastructure mutation.

### 3) Receipt governance
- Retain receipts according to control and jurisdiction obligations.
- Verify receipt integrity fields (`hash`, `chainHash`) in audit workflows.
- Correlate receipt IDs with execution IDs and change records.

### 4) Step-up and escalation controls
- Ensure `STEP_UP` paths require stronger attestation.
- Ensure `ESCALATE` paths bind to documented approver roles.
- Require explicit evidence for any production mutation approvals.

## Control mapping readiness

The repository includes framework-aware compliance structures for governance workflows, including support for mapping to NIST, SOC2, PCI_DSS, SOX, FFIEC, CMMC, ISO27001, and EU_AI_ACT contexts.

## Recommended operating checks

- Run CI health checks (`.github/workflows/ci.yml`).
- Run governed-execution checks (`.github/workflows/governed_execution.yml`).
- Periodically validate that constrained permits are not treated as full permits in downstream execution surfaces.
