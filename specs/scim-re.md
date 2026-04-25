# SCIM-RE Specification (Runtime Execution Governance Protocol)

## Purpose
SCIM-RE governs execution-time authorization by evaluating trust and policy at runtime.

## Normative constraints
- Trust is evaluated before execution.
- No implicit trust exists after provisioning.
- Every governed action calls `POST /re/authorize`.
- Every decision produces an `ExecutionReceipt`.

## Required behavior
1. Accept an authorization request with principal, action, resource, and context.
2. Evaluate trust and policy in real time.
3. Return one decision enum value: `PERMIT`, `DENY`, `STEP_UP`, `ESCALATE`, `CONSTRAIN`.
4. Emit a signed or hash-linked execution receipt.

## Enforcement boundary
SCIM-RE decisions are enforced at FrontDesk, not by TTP alone.
