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
