# RAP Specification (Runtime Authority Protocol)

## Purpose
RAP defines runtime authority semantics across governed systems and service boundaries.

## Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.

## Authority model
- Authority is contextual, time-bounded, and revocable.
- AuthorityGrant artifacts MUST be validated at decision time.
- Constrained execution MUST include machine-readable limits.

## Decision contract
RAP implementations MUST return one of:
- `PERMIT`
- `DENY`
- `STEP_UP`
- `ESCALATE`
- `CONSTRAIN`
