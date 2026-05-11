# TTP vs RAP vs SCIM-RE

TTP, SCIM-RE, RAP, Execution Exchange, FrontDesk, and VerifiedTrust are separate layers. TTP should not claim the responsibilities of the other layers.

## Layer Comparison

| Layer | Primary Responsibility | Example Artifacts | TTP Boundary |
| --- | --- | --- | --- |
| TTP | Expresses trust claims, trust decay, trust transfer, delegation, proof requirements, and authority context. | `.ttp` files, trust claims, proofs, evaluation result JSON. | Produces trust context that runtime systems can evaluate. |
| SCIM-RE | Defines runtime execution governance resources. | `WorkloadIdentity`, `AuthorityGrant`, `Attestation`, `ExecutionRequest`, `ExecutionReceipt`. | Can consume TTP subject, trust, and attestation fields. |
| RAP | Defines runtime authority decision exchange before action. | Requests/responses with `PERMIT`, `STEP_UP`, `DENY`, `THROTTLE`, `ESCALATE`, `CONSTRAIN`. | Can use TTP evaluation as one input to runtime decisions. |
| Execution Exchange | Gateway that enforces RAP decisions across routes and runtime integrations. | Enforcement routes, gateway policy, receipts. | Calls RAP before execution and may pass TTP context. |
| FrontDesk | Business and operator control plane. | Approvals, receipts, agents, outcomes, customer impact views. | Displays evidence and approval trails informed by TTP/RAP/SCIM-RE. |
| VerifiedTrust | Enterprise NHI posture and governance platform. | Policy, lifecycle, compliance, identity posture. | May issue, manage, or validate trust claims, but TTP remains portable. |

## TTP

TTP expresses:

- Trust claims.
- Trust decay.
- Trust transfer.
- Delegation.
- Proof requirements.
- Authority context.

It produces trust context and evaluation results. It does not enforce execution by itself.

## SCIM-RE

SCIM-RE defines runtime execution governance resources:

- `WorkloadIdentity`
- `AuthorityGrant`
- `Attestation`
- `ExecutionRequest`
- `ExecutionReceipt`

SCIM-RE provides the resource model that runtime systems can use to represent who acted, under which grant, with what evidence, and what receipt was produced.

## RAP

RAP is the Runtime Authority Protocol. It defines the decision exchange before execution.

RAP decisions include:

- `PERMIT`
- `STEP_UP`
- `DENY`
- `THROTTLE`
- `ESCALATE`
- `CONSTRAIN`

RAP evaluates runtime context, policy, trust, risk, and required controls before action.

## Execution Exchange

Execution Exchange is the enforcement layer. It calls RAP before execution, applies the decision across routes or runtime integrations, and produces or forwards receipts.

## FrontDesk

FrontDesk is the operator and business control plane. It shows approvals, receipts, agents, outcomes, customer impact, and escalation trails.

## VerifiedTrust

VerifiedTrust is the enterprise NHI posture and governance platform. It manages policies, identity posture, lifecycle, and compliance views.

## Example Flow

1. Agent wants to update a CRM record.
2. Agent presents TTP trust context.
3. SCIM-RE identifies the workload and grant.
4. RAP evaluates the runtime decision.
5. Execution Exchange enforces the decision.
6. FrontDesk shows receipt and approval trail.
