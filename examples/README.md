# Examples (Integration Patterns)

Use these examples to wire runtime authority into real execution surfaces.

## Decision handling rule (applies to all examples)
No protected action executes until `POST /re/authorize` returns a decision and receipt.

## Choose by integration surface

### CI/CD
- `governed-ci/github-actions-governed-step.md`
- `governed-ci/azure-devops-governed-pipeline.md`

### API / runtime enforcement
- `api-gateway/api-gateway-enforcement.md`
- `copilot-tool-gate/copilot-tool-call-gate.md`
- `github-app-self-governance.md`

## How to use examples correctly

1. Adapt request context fields to your environment/classification model.
2. Keep decision enforcement logic thin in callers.
3. Keep governance logic centralized in FrontDesk.
4. Persist receipt IDs and integrity fields with execution logs.

## Production note
Examples are patterns, not production defaults. Apply your org’s auth, retention, and approval controls before rollout.
