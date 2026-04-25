# User Guide (Integrators)

## Who this is for

This guide is for teams integrating governed execution into CI/CD, APIs, and agent runtimes.

## What you get

- Runtime authorization via `POST /re/authorize`
- Deterministic decision outcomes (`PERMIT`, `STEP_UP`, `ESCALATE`, `DENY`)
- Decision modes (`FULL`, `CONSTRAINED`, etc.)
- Portable `ExecutionReceipt` evidence

## Integration path

1. **Read protocol contracts**
   - `specs/scim-re.md`
   - `specs/scim-re-authorize-api.md`
   - `specs/execution-receipt.md`

2. **Stand up FrontDesk locally**
   - `reference-implementations/runtime-authority-gate/`
   - Run `node server.mjs`

3. **Integrate clients**
   - Node SDK: `sdk/node`
   - Python SDK: `sdk/python`

4. **Apply enforcement patterns**
   - CI/CD examples: `examples/governed-ci/`
   - API example: `examples/api-gateway/`
   - Agent/tool example: `examples/copilot-tool-gate/`

## Decision handling contract

- `PERMIT` + `FULL`: allow intended execution.
- `PERMIT` + `CONSTRAINED`: allow with narrowed capability.
- `STEP_UP`: pause execution and request stronger proof/fresher attestation.
- `ESCALATE`: route to human/privileged approval path.
- `DENY`: block execution.

## Non-negotiable integration rules

- No execution without authorization response.
- No authorization response without receipt.
- Persist receipt IDs with execution logs for audit traceability.
