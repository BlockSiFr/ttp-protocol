# Protected Action Model

## Scope

Protected actions in v1:
- merge to main
- release tag / release workflow
- edits to `.github/workflows/**`
- edits to `policy/**`
- edits to `receipts/schemas/**`
- trust/authorization semantic changes
- signing/verifier/key path changes

## Risk classes

- Low: comments, labels
- Medium: PR review and non-protected advisory updates
- High: core semantic/runtime changes
- Critical: protected actions above

## Enforcement

For protected actions, valid outcomes are typically `STEP_UP`, `ESCALATE`, or `DENY` unless a strict permit path exists.

Fail closed if authority, attestation freshness, or protected-path context is ambiguous.

Evaluation and enforcement are intentionally separated:
- `protected-action-gate` evaluates and emits `decision`, `receipt_id`, and `reason`.
- `step-up-approval` runs only for `STEP_UP`/`ESCALATE`.
- `reauthorize-after-step-up` requests a second decision after approval.
- `merge-authority` is the only terminal enforcement gate.

Workflow contract details: `docs/protected-gate-workflow-contract.md`.
