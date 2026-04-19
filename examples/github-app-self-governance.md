# Example: GitHub App + Runtime Authority Integration

This example shows how a GitHub App invokes Runtime Authority before executing sensitive repository actions.

## Pattern

1. GitHub event arrives (issue comment, PR review request, workflow dispatch intent).
2. App/worker resolves role-agent identity and action context.
3. Worker calls `POST /re/authorize`.
4. Authority returns `PERMIT|CONSTRAIN|STEP_UP|ESCALATE|DENY` + receipt.
5. Worker enforces decision and records receipt linkage.

## Key controls

- no standing workflow authority
- short-lived grants per action
- step-up for protected actions
- signed, chain-hashed receipts for every meaningful decision
