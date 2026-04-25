# Trust Decay Specification

## Purpose
Defines how trust confidence reduces over time without fresh positive evidence.

## Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.

## Baseline model
- Start from latest validated trust signal.
- Apply decay as elapsed time increases.
- Apply penalties for adverse events.
- Allow recovery from verified positive evidence.

## Example function
`effectiveTrust = max(0, baseTrust * e^(-lambda * ageHours) - penalties + recovery)`

## Governance thresholds
- trust >= 0.85: eligible for `PERMIT/FULL` if risk, cost, and compliance checks pass.
- 0.65 <= trust < 0.85: `PERMIT/CONSTRAINED`.
- 0.40 <= trust < 0.65: `STEP_UP` (typically `REQUIRES_REATTESTATION`).
- trust < 0.40: `DENY` unless human escalation changes status.
