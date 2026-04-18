# Protected Merge Gate Workflow Contract

This document describes the runtime contract implemented by `.github/workflows/ttp-protected-gate.yml`.

## Decision flow

1. `protected-action-gate` calls the local TTP authority evaluator (`.github/scripts/ttp-local-authorize.mjs`).
2. The local evaluator returns a decision and receipt and writes receipts under `.ttp/receipts/`.
3. If decision is `STEP_UP` or `ESCALATE`, `step-up-approval` runs through the protected environment.
4. `reauthorize-after-step-up` sends a second `POST /re/authorize` request with the prior receipt and approval context.
5. `merge-authority` enforces the final decision; only `PERMIT` allows merge.

## Required minimum authority response

The workflow enforces the following minimum response contract for both initial authorization and re-authorization:

```json
{
  "decision": "PERMIT" | "STEP_UP" | "ESCALATE" | "DENY",
  "receiptId": "string",
  "reason": "string"
}
```

If the response is missing `decision`, `receiptId`, or valid JSON, the workflow fails closed (`DENY`) with an explicit reason code.

## Fail-closed conditions

The workflow denies merge when any of the following occurs:
- local authority execution fails,
- response JSON is malformed,
- decision value is invalid,
- receipt id is missing,
- re-authorization decision is missing after step-up/escalation.

## Receipt enforcement

A receipt is mandatory for every authority decision used in merge enforcement:
- initial gate decision must have `receiptId`,
- re-authorization decision must have a new `receiptId` when step-up/escalation is required.

No final `PERMIT` without a receipt.
