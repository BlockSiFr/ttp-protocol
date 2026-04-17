# TTP Getting Started

This guide gives a fast path from zero to first protected action, then helps teams choose the right adoption path.

## Quickstart (Simple Path)

1. Run the Trust Authority using the reference implementation.
2. Register one agent and one issuer via admin endpoints.
3. Submit receipts from the issuer as agent actions occur.
4. Request a trust token from the agent.
5. Verify the token in your service and enforce `minScore`.

Use full commands and setup details in [integration-guide.md](integration-guide.md).

---

## Integration Paths (Choose One)

### Path A — Agent Builder
- Integrate `TTPClient` in agent runtime.
- Request short-lived, domain-scoped trust tokens.
- Pass `X-TTP-Token` to protected downstream services.

### Path B — Service/API Owner
- Add TTP middleware or manual verification.
- Configure per-route `domain` and `minScore`.
- Choose risk-appropriate fallback strategy.

### Path C — Platform/Security Operator
- Operate Trust Authority and issuer registry.
- Register agents and issuers.
- Manage trust thresholds, domain boundaries, and quarantine policy.

---

## Build the Network (Core -> Edge Participation)

Teams can adopt incrementally:

1. **Network Core Operator** — runs Trust Authority and governance.
2. **Issuer Operator** — submits signed behavioral evidence.
3. **Verifier / Service Owner** — enforces trust at action boundaries.
4. **Agent Builder** — makes agents token-aware.

Suggested starts:
- Enterprise platform teams: Core + Verifier
- Security vendors: Issuer + Verifier
- Agent framework teams: Agent Builder + Issuer
- Product teams: Verifier first, then issuer coverage

---

## Identity Assurance (Cover All Bases)

Identity assurance should span:
- **Methodology**: canonical identity source + lifecycle states.
- **Workflow**: registration, verification gates, response playbooks.
- **Code**: normalization, unknown principal rejection, replay/clock controls.
- **Reasoning**: deterministic policy decisions with explicit threshold rationale.

Use the full checklist in [integration-guide.md#67-identity-gap-closure-checklist-methodology-workflow-code-reasoning](integration-guide.md#67-identity-gap-closure-checklist-methodology-workflow-code-reasoning).
