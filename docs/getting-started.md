# TTP Getting Started

This guide gives a fast path from zero to first protected action, then helps teams choose the right adoption path.

## Quickstart: First Trust Gate

Run the dependency-free local demo:

```bash
npm run demo
```

The demo shows the core TTP control loop:

1. A trusted build action receives `PERMIT`.
2. A production deploy receives `STEP_UP`.
3. A revoked workload receives `DENY`.
4. Each decision produces an execution receipt with a chain hash.

This is the fastest way to see the platform intent: TTP is a runtime trust gate for protected actions, not a replacement for identity, CI, API gateways, or policy engines.

## Next: Wire A Real Boundary

After the demo, choose one protected action in your system:

- a production deploy
- a privileged tool call
- a customer-impacting agent action
- a write operation against sensitive data
- a high-risk workflow step

Then add TTP at that boundary:

1. Define the subject, action, resource, and parameter hash.
2. Attach at least one issuer that can observe recent behavior.
3. Resolve the trust route before execution.
4. Enforce `PERMIT`, `DENY`, `STEP_UP`, `THROTTLE`, or `CONSTRAIN`.
5. Store the execution receipt for audit and incident review.

Use full setup details in [integration-guide.md](integration-guide.md).

---

## Integration Paths (Choose One)

### Path A - Agent Builder
- Integrate `TTPClient` in agent runtime.
- Request short-lived, domain-scoped trust tokens.
- Pass `X-TTP-Token` to protected downstream services.

### Path B - Service/API Owner
- Add TTP middleware or manual verification.
- Configure per-route `domain` and `minScore`.
- Choose risk-appropriate fallback strategy.

### Path C - Platform/Security Operator
- Operate Trust Authority and issuer registry.
- Register agents and issuers.
- Manage trust thresholds, domain boundaries, and quarantine policy.

---

## Build the Network (Core -> Edge Participation)

Teams can adopt incrementally:

1. **Network Core Operator** - runs Trust Authority and governance.
2. **Issuer Operator** - submits signed behavioral evidence.
3. **Verifier / Service Owner** - enforces trust at action boundaries.
4. **Agent Builder** - makes agents token-aware.

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
