# RFC-0001: GitHub Self-Governance with TTP + SCIM-RE

Status: Draft

This RFC introduces runtime governance for non-human GitHub role-agents using TTP authority gates and SCIM-RE authority-plane resources.

Normative additions:
- Runtime Authority Gate (`POST /re/authorize`) for meaningful repo actions
- Extended `ExecutionReceipt` structure with risk/compliance/cost context
- Policy outcomes: PERMIT, CONSTRAIN, STEP_UP, ESCALATE, DENY
- Protected action handling with mandatory step-up/escalation paths

Companion docs:
- `docs/github-self-governance-reference-architecture.md`
- `runtime/api/re-authorize.contract.md`
- `spec/extensions/execution-receipt-v2.schema.json`
- `policy/github-self-governance-policy.yaml`
