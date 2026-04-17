# Acceptance Test: Protected Workflow Edit Gate

1. Open a PR that changes `.github/workflows/build.yml`.
2. `TTP / Protected Action Gate` detects critical-path change.
3. Workflow calls `POST /re/authorize`.
4. Gate returns `STEP_UP`, `ESCALATE`, or `DENY` unless valid permit path exists.
5. Check fails closed until valid approval/attestation exists.
6. Link fresh approval/attestation evidence.
7. Gate re-evaluates.
8. `ExecutionReceipt` is generated and surfaced.
9. Merge can proceed only with valid `PERMIT` + receipt.
