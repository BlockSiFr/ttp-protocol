# ICP and Personas

This document defines the first go-to-market audience for TTP. It is intentionally narrow: TTP should lead with teams that already feel pain from autonomous execution, non-human identity sprawl, and privileged automation.

## Priority Segments

| Priority | Segment | Trigger | Why TTP fits |
| --- | --- | --- | --- |
| 1 | AI platform and agent infrastructure teams | Agents are moving from experiments to workflows that write, deploy, approve, or change customer-impacting systems. | TTP adds current trust, proof, and receipts before action execution without replacing identity or policy infrastructure. |
| 2 | Security engineering and identity governance teams | Static service account permissions, CI tokens, or agent credentials are too broad for runtime risk. | TTP gives a portable way to evaluate freshness, delegation, route validity, and threshold proof at the boundary. |
| 3 | DevOps and platform teams governing CI/CD | Production deploy, environment mutation, or privileged workflow steps require stronger pre-execution checks. | TTP can gate protected actions with `PERMIT`, `DENY`, `STEP_UP`, `THROTTLE`, or `CONSTRAIN` and emit receipts for review. |

## Primary Personas

| Persona | Jobs to be done | Adoption ask | Success signal |
| --- | --- | --- | --- |
| Platform security lead | Reduce risk from autonomous or semi-autonomous execution. | Pilot one governed workflow with receipt capture. | A protected action is denied or stepped up based on trust state rather than static identity alone. |
| Agent platform engineer | Add trust-aware execution to agent runtime or tool calls. | Integrate SDK token request and pass tokens to a protected service. | Agent actions carry scoped, short-lived trust context. |
| API/service owner | Protect a sensitive write path without replacing IAM. | Add verifier middleware or manual token verification. | Service rejects stale, insufficient, or domain-mismatched trust. |
| Compliance/security reviewer | Understand why an action was allowed or blocked. | Review execution receipts and policy rationale. | A receipt explains actor, action, threshold, trust route, and decision. |

## Buying Triggers

- AI agents are being granted write access to production systems.
- CI/CD workflows rely on long-lived credentials or broad service accounts.
- A security review asks how agent actions are authorized after identity is established.
- A customer requires evidence for why an automated action was permitted.
- Existing policy engines lack fresh behavioral trust, decay, or route proof semantics.

## Non-ICP For Now

- Teams looking for a hosted governance dashboard as the first deliverable.
- Teams that only need static identity authentication.
- Teams that require production-grade cryptographic enforcement before a pilot.
- Teams that cannot identify one concrete protected action to gate.
