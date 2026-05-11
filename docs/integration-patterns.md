# Integration Patterns

TTP is most useful when a runtime control point can evaluate trust before execution and fail closed when trust is insufficient.

## AI Agent Runtime

- **What calls TTP:** Agent runtime or tool executor.
- **What TTP evaluates:** Subject trust, tool/action scope, proof freshness, threshold, decay.
- **What happens next:** Runtime allows tool call, requests step-up through RAP, or blocks execution.
- **Where other layers fit:** SCIM-RE models workload and grant; RAP returns the decision; FrontDesk displays receipts and approval trails.

## GitHub Actions

- **What calls TTP:** Protected workflow step or pre-deploy gate.
- **What TTP evaluates:** Pipeline subject, repository scope, issuer trust, deployment authority threshold.
- **What happens next:** Workflow proceeds, pauses for approval, or fails closed.
- **Where other layers fit:** RAP can map result to `PERMIT`, `STEP_UP`, or `DENY`; Execution Exchange can enforce protected routes.

## Azure DevOps

- **What calls TTP:** Pipeline task before environment deployment or service connection use.
- **What TTP evaluates:** Pipeline identity, environment scope, recent attestation, threshold, expiration.
- **What happens next:** Deployment continues only if current trust satisfies the authority context.
- **Where other layers fit:** SCIM-RE models workload identity and authority grant; FrontDesk can show approval evidence.

## API Gateway

- **What calls TTP:** Gateway plugin, sidecar, or external authorization service.
- **What TTP evaluates:** API caller trust, action/resource scope, proof mode, threshold.
- **What happens next:** Gateway forwards, constrains, throttles, or rejects the request.
- **Where other layers fit:** RAP owns decision semantics; Execution Exchange owns route enforcement.

## MCP Tool Gateway

- **What calls TTP:** MCP tool gateway before tool invocation.
- **What TTP evaluates:** Agent subject, tool scope, issuer trust, freshness, and threshold.
- **What happens next:** Tool call is allowed, constrained, escalated, or denied.
- **Where other layers fit:** RAP supplies decision vocabulary; FrontDesk can show operator-visible evidence.

## FrontDesk Runtime Authority Gate

- **What calls TTP:** FrontDesk-integrated authority gate.
- **What TTP evaluates:** Business action trust, proof freshness, delegated authority, and evidence references.
- **What happens next:** FrontDesk presents approval, receipt, or escalation workflow.
- **Where other layers fit:** SCIM-RE models execution receipt; RAP returns authority decision.

## NHI Governance Workflow

- **What calls TTP:** Governance workflow or posture engine.
- **What TTP evaluates:** Non-human identity trust, lifecycle state, issuer claims, scope, decay.
- **What happens next:** Governance system updates posture, recommends constraints, or blocks high-risk activity through runtime controls.
- **Where other layers fit:** VerifiedTrust manages posture and lifecycle; TTP remains the portable trust grammar.
