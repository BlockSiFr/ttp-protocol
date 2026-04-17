# SCIM-RE Mapping Appendix: GitHub Role-Agents

## Resource mapping

- WorkloadIdentity -> GitHub role-agent identity (GitHub App subject + role manifest)
- AuthorityGrant -> scoped, time-bounded action permission envelope
- Attestation -> freshness/legitimacy proof bound to invocation context
- ExecutionReceipt -> signed, chain-hashed decision artifact

## Plane separation

- Provisioning plane: account/group lifecycle (unchanged)
- Authority plane: runtime decisioning (`/re/authorize`) and receipt generation

## Outcome mapping

- `PERMIT` -> authorized action execution
- `CONSTRAIN` -> authorized with reduced scope
- `STEP_UP` -> requires additional human/environment approval
- `ESCALATE` -> routed to higher authority chain
- `DENY` -> blocked and receipted
