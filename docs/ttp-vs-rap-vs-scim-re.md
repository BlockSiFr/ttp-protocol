# TTP vs RAP vs SCIM-RE

TTP, SCIM-RE, RAP, Execution Exchange, CortexTrace, and ExecutionReceipts are separate layers. TTP should not claim the responsibilities of downstream authority, enforcement, or evidence systems.

## Layer Comparison

| Layer | Primary Responsibility | Example Artifacts | TTP Boundary |
| --- | --- | --- | --- |
| TTP | Establishes trustworthiness through trust claims, proof requirements, attestations, delegation, scope, and TrustDecay. | `.ttp` files, TrustClaim, TrustProof, trust proof outcomes. | Produces trust context and proof results for downstream systems. |
| SCIM-RE | Structures runtime trust context. | `WorkloadIdentity`, `AuthorityGrant`, `Attestation`, `ExecutionRequest`, `ExecutionReceipt`. | Carries TTP subject, trust, and attestation context. |
| RAP | Evaluates authority. | Requests/responses with `allow`, `step_up`, `deny`, `throttle`, and `escalate` semantics. | May use TTP TrustProof as one input to runtime authority evaluation. |
| Execution Exchange | Enforces downstream runtime decisions in production. | Enforcement routes, gateway policy, commercial runtime authority gates, receipts. | Consumes trust and authority context; enforcement remains downstream. |
| CortexTrace | Records evidence and receipts. | Evidence references, receipt chains, audit exports. | Records how trust proof and authority context supported downstream decisions. |

## TTP

TTP establishes trustworthiness. It expresses Subjects, TrustClaims, TrustIssuers, AuthorityGrants, Attestations, TrustDecay, Delegation, TrustProofs, RuntimeDecision context, and ExecutionReceipt references.

It produces trust context and trust proof results. It does not enforce execution by itself.

## SCIM-RE

SCIM-RE structures runtime trust context with resources such as `WorkloadIdentity`, `AuthorityGrant`, `Attestation`, `ExecutionRequest`, and `ExecutionReceipt`.

## RAP

RAP evaluates authority before downstream action. RAP can consume TTP proof results and runtime context to produce decisions such as `allow`, `step_up`, `deny`, `throttle`, and `escalate`.

## Execution Exchange

Execution Exchange is the commercial enforcement layer. It applies downstream runtime decisions across protected routes and production integrations.

## CortexTrace

CortexTrace records evidence and receipts so governed decisions can be verified after the fact.

## Example Flow

1. An agent wants to update a protected record.
2. TTP establishes trustworthiness and produces a TrustProof.
3. SCIM-RE structures the workload, AuthorityGrant, Attestation, and receipt context.
4. RAP evaluates authority.
5. Execution Exchange enforces the downstream decision.
6. CortexTrace records evidence and receipts.

## Legacy Naming

Older documents may mention legacy FrontDesk as legacy operator-control-plane naming. The primary commercial product name for production enforcement is Execution Exchange.
