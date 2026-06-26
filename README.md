<p align="center">
  <img src="assets/ttp-hero.svg" alt="Trust Transfer Protocol — Trust-Before-Execution for AI agents and non-human identities" width="100%">
</p>

<p align="center">
  <img alt="spec" src="https://img.shields.io/badge/spec-v1.0-00D4FF?style=flat-square&labelColor=0A0A0F">
  <img alt="protocol" src="https://img.shields.io/badge/protocol-TTP-00B8A9?style=flat-square&labelColor=0A0A0F">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-in__progress-FFB300?style=flat-square&labelColor=0A0A0F">
  <img alt="reference" src="https://img.shields.io/badge/reference-Node.js-00E676?style=flat-square&labelColor=0A0A0F">
  <br>
  <img alt="trust model" src="https://img.shields.io/badge/trust__model-decay__enabled-00D4FF?style=flat-square&labelColor=0A0A0F">
  <img alt="receipts" src="https://img.shields.io/badge/receipts-cryptographic-00B8A9?style=flat-square&labelColor=0A0A0F">
  <img alt="category" src="https://img.shields.io/badge/category-agent__trust__infrastructure-8892A0?style=flat-square&labelColor=0A0A0F">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-0066CC?style=flat-square&labelColor=0A0A0F"></a>
</p>

<p align="center">
  <strong>The protocol layer for agent trust.</strong><br>
  Every action must earn authority before execution. Every decision must be provable after.
</p>

<p align="center">
  <a href="SPECIFICATION.md"><b>Read the Spec</b></a> &nbsp;·&nbsp;
  <a href="#-quickstart"><b>Quickstart</b></a> &nbsp;·&nbsp;
  <a href="examples/"><b>Examples</b></a> &nbsp;·&nbsp;
  <a href="CONTRIBUTING.md"><b>Contribute</b></a>
</p>

---

Identity proves *who* is acting. Authorization defines *what* was assigned. **TTP establishes whether the actor is trustworthy enough for this action, right now** — before any downstream authority or execution decision is made.

OAuth standardized delegated access. SCIM standardized identity provisioning. **TTP standardizes trust-before-execution for autonomous systems.** It is a platform-agnostic trust protocol — bring any agent, IdP, gateway, or workflow.

<p align="center">
  <img src="assets/diagrams/protocol-loop.svg" alt="Identity, Attestation, Trust Evaluation, Runtime Authority Gate, Decision, Execution Receipt" width="100%">
</p>

## Why TTP Exists

Software is moving from advising to acting. Agents call tools, copilots trigger workflows, pipelines modify production, service accounts move data. The old model — `authenticate → authorize → execute → log` — never asks the question that matters at runtime:

> **Should this specific action execute right now, given how trustworthy the actor is at this moment?**

<p align="center">
  <img src="assets/diagrams/trust-gap.svg" alt="Identity asks who, Authorization asks what may be accessed, TTP asks whether this action should execute now" width="100%">
</p>

## How TTP Works

Trust is established from evidence, scored against a threshold, and checked at a runtime authority gate **before** the action runs. The gate consumes a trust proof, an authority grant, and the current decay state — then emits a decision and a signed receipt.

<p align="center">
  <img src="assets/diagrams/runtime-authority-flow.svg" alt="A request is evaluated by the runtime authority gate against trust, authority and decay, producing a decision and a receipt" width="100%">
</p>

### Runtime Decisions

A trust proof resolves into one of five outcomes. TTP establishes the trust context; downstream runtime authority systems enforce the decision.

<p align="center">
  <img src="assets/diagrams/decision-matrix.svg" alt="Decision outcomes: allow, throttle, step-up, escalate, deny" width="100%">
</p>

## First Example

Declare a subject, attach evidence, and require a trust threshold before the action is allowed:

```ttp
trust "invoice_agent" {
  subject     = agent:invoice-bot
  issuer      = trust-issuer:finance-control
  score       = 0.91
  decay       = exponential(halflife = 6h)   # trust weakens without fresh evidence
  scope       = [invoice.read, invoice.write]
  evidence    = [attestation:att-7b3c, receipt:rcpt-01J9F4]
}

policy "write_invoices" {
  action            = invoice.write
  require_trust     = 0.80                     # threshold the proof must clear
  on_below          = step-up                  # otherwise demand fresh attestation
  execution_policy  = gate                     # decide before execution, fail closed
  emit              = execution_receipt        # cryptographic proof of the decision
}
```

Trust does not stay still. Without fresh attestation it **decays** through `active → degraded → warning → critical`; a new attestation **recharges** it.

<p align="center">
  <img src="assets/diagrams/trust-decay-curve.svg" alt="Trust decays over time across active, degraded, warning and critical bands and is recharged by attestation" width="100%">
</p>

## Execution Receipts

Every decision produces a signed, hash-chained `ExecutionReceipt` — evidence, not a log line. It records what was decided, the trust state behind it, and the cryptographic basis to verify it later.

<p align="center">
  <img src="assets/diagrams/execution-receipt.svg" alt="Execution receipt with subject, action, resource, decision, trust score, references, signature and chain hash" width="660">
</p>

## Architecture

TTP is the foundation layer. Runtime governance, the authority gate, and the enterprise control plane build on it; agent frameworks, CI/CD, APIs, and copilots consume it.

<p align="center">
  <img src="assets/diagrams/architecture-stack.svg" alt="TTP architecture stack: protocol, SCIM-RE governance, runtime authority gate, execution exchange, consumers" width="860">
</p>

> TTP establishes trustworthiness. **SCIM-RE** structures runtime context, **RAP** evaluates authority, **Execution Exchange** enforces decisions, and **CortexTrace** records evidence. TTP does not enforce execution by itself — see [COMMERCIAL_BOUNDARY.md](COMMERCIAL_BOUNDARY.md).

## Integrations

Bring your existing agents — no rewrite, no IdP replacement. TTP wraps the boundary where an action happens.

<p align="center">
  <img src="assets/diagrams/integrations.svg" alt="Integration surfaces: GitHub Actions, CI/CD, API gateways, service accounts, Microsoft Copilot, Azure DevOps, LangChain, CrewAI" width="100%">
</p>

## Roadmap

<p align="center">
  <img src="assets/diagrams/roadmap.svg" alt="Roadmap phases from spec and reference through production hardening" width="100%">
</p>

## Quickstart

```bash
git clone https://github.com/BlockSiFr/ttp-protocol.git
cd ttp-protocol
npm install
npm test

# evaluate the reference examples
npm run ttp -- check examples/01-basic-agent.ttp
npm run ttp -- eval  examples/02-trust-decay.ttp --subject agent:invoice_reviewer --at now
npm run demo
```

`check` validates a `.ttp` file; `eval` evaluates a subject's trust at a point in time; `demo` prints reference decisions, trust scores, and `ExecutionReceipt` identifiers for local, non-production scenarios.

## Protocol Primitives

| Primitive | Meaning |
| --- | --- |
| **Subject** | The agent, service account, pipeline, API client, workload, or workflow being evaluated. |
| **TrustClaim** | A scoped statement that a Subject holds a trust score or state, issued by a trust issuer. |
| **AuthorityGrant** | A bounded right relied on only when trust, freshness, scope, and constraints are satisfied. |
| **Attestation** | Fresh evidence that the subject, credential, workload, or runtime context remains valid. |
| **TrustDecay** | The time-based weakening of trust when fresh evidence is absent. |
| **Delegation** | Bounded transfer of trust or authority from one subject to another. |
| **IsnadChain** | A verifiable chain of trust transmission from a rooted authority to the acting subject. |
| **TrustProof** | A structured proof that trust conditions were evaluated and satisfied — or not. |
| **RuntimeDecision** | A downstream enforceable decision: `allow`, `throttle`, `step-up`, `escalate`, `deny`. |
| **ExecutionReceipt** | A signed proof object recording the decision, trust state, authority basis, and receipt chain. |

## Open Protocol, Commercial Enforcement

Open-source TTP includes the protocol grammar, trustworthiness semantics, the trust-proof model, public schemas, example `.ttp` files, SDK primitives, a reference evaluator, and the TrustDecay model. Production enforcement — managed Runtime Authority Gate, the Execution Exchange control plane, HSM-backed signing, and the CortexTrace evidence engine — is commercial BlockSiFr infrastructure. The boundary is explicit in [COMMERCIAL_BOUNDARY.md](COMMERCIAL_BOUNDARY.md).

## Security

TTP is a protocol draft and reference implementation. **Do not use `cleartext-dev` proof mode in production.** Production trust establishment and enforcement require a trusted issuer registry, signed claims, replay protection, clock integrity, key rotation, tenant isolation, fail-closed enforcement, receipt signing, and audit retention. See [SECURITY.md](SECURITY.md) and [THREAT_MODEL.md](THREAT_MODEL.md).

## Contributing

From a first issue to owning a protocol surface — the path is open and intentional. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [GOVERNANCE.md](GOVERNANCE.md).

<p align="center">
  <img src="assets/diagrams/contributor-path.svg" alt="Contributor path: start here, good first issue, protocol RFC, runtime implementation, docs and examples, maintainer path" width="100%">
</p>

## License

[Apache-2.0](LICENSE) · A [BlockSiFr](https://blocksifr.com) open protocol · Trust-Before-Execution for autonomous systems.
