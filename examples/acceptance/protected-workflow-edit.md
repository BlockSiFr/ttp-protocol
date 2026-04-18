# Acceptance Test: Protected Workflow Edit Gate

1. Open a PR that changes `.github/workflows/build.yml`.
2. `TTP / Protected Action Gate` detects critical-path change.
3. Workflow calls `POST /re/authorize`.
4. Gate returns `STEP_UP`, `ESCALATE`, or `DENY` unless valid permit path exists.
5. Evaluation job succeeds and emits `decision`, `receipt_id`, and `reason`.
6. If decision is `STEP_UP`/`ESCALATE`, human approval is collected through protected environment reviewers.
7. Workflow calls `POST /re/authorize` with `priorReceiptId` and approval context.
8. `ExecutionReceipt` is generated for the re-authorization decision and surfaced.
9. Merge can proceed only with valid `PERMIT` + receipt.
