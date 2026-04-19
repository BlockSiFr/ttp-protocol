# GitHub Self-Governance (TTP Governing TTP)

TTP governs protected GitHub actions by requiring a runtime authorization decision before execution.

Runtime gate endpoint: `POST /re/authorize`

Decision tuple:

`Decision = f(authority, trust, risk, compliance, cost, context, constraints)`

Decision outcomes (v1):
- `PERMIT`
- `STEP_UP`
- `ESCALATE`
- `DENY`

Mandatory rule: no protected action executes without an `ExecutionReceipt`.

See also:
- `docs/protected-action-model.md`
- `runtime/api/re-authorize.contract.md`
- `receipts/schemas/execution-receipt.v1.json`
