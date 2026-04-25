# SCIM-RE Specification (Runtime Execution Governance Protocol)

## Purpose
SCIM-RE governs execution-time authorization by evaluating authority, trust, risk, cost, and compliance at runtime.

## Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.

## Required behavior
1. Accept authorization requests with subject, action, resource, context, and attestation references.
2. Evaluate identity validity, authority grants, trust score, risk posture, cost policy, and compliance obligations.
3. Return exactly one decision outcome: `PERMIT`, `STEP_UP`, `ESCALATE`, or `DENY`.
4. Return a decision mode: `FULL`, `CONSTRAINED`, `REQUIRES_REATTESTATION`, `REQUIRES_HUMAN_APPROVAL`, or `FAILED_CLOSED`.
5. Emit a structured execution governance receipt for every decision.

## Enforcement boundary
SCIM-RE decisions are enforced at FrontDesk, not by TTP alone.
