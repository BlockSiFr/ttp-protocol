<h1 align="center">Trust Transfer Protocol</h1>

<p align="center">
  <strong>Trustworthiness establishment for autonomous systems.</strong>
</p>

<p align="center">
  TTP is the open protocol for proving whether an AI agent, copilot, workflow, pipeline, API, service account, or non-human identity is trustworthy enough to be relied on before downstream authority and execution decisions occur.
</p>

<p align="center">
  <strong>No implicit trust. No stale delegation. No blind reliance on autonomous actors.</strong>
</p>

<p align="center">
  <a href="SPECIFICATION.md"><img alt="Protocol" src="https://img.shields.io/badge/protocol-draft-2f6fed"></a>
  <img alt="Category" src="https://img.shields.io/badge/category-trustworthiness_establishment-00D4FF">
  <img alt="Runtime" src="https://img.shields.io/badge/runtime-reference_evaluator-00E676">
  <a href="SECURITY.md"><img alt="Production" src="https://img.shields.io/badge/production-not_recommended_alone-FF3D00"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache_2.0-blue"></a>
  <a href="SECURITY.md"><img alt="Security policy" src="https://img.shields.io/badge/security-policy_documented-7c3aed"></a>
</p>

Identity proves who is acting. Authorization says what was assigned. TTP establishes whether the actor is trustworthy enough for this context, right now.

TTP is a platform-agnostic trust protocol for evidence-backed trustworthiness establishment across autonomous systems.

OAuth standardized delegated access.
SCIM standardized identity provisioning.
TTP standardizes trustworthiness establishment before autonomous execution.

## Status

* Protocol draft.
* Reference evaluator active.
* MVP parser and trust decay evaluator available.
* Not recommended for production enforcement by itself.
* TTP establishes trustworthiness context; it does not enforce execution alone.

## First Principles

Software is moving from advising to acting.

When software acts, it must be trustworthy.
When trust is stale, reliance becomes risk.
When trust decays, trustworthiness must be re-established.
When trustworthiness is evaluated, evidence must be produced.
When downstream authority systems act on that evaluation, a receipt should exist.

The old model is incomplete:

```text
authenticate -> authorize -> execute -> log
```

Autonomous systems require a new model:

```text
identity -> trustworthiness -> authority -> execution -> receipt
```

TTP defines the protocol layer for establishing trustworthiness before downstream authority and execution decisions.

## The Category

Autonomous systems have crossed from recommendation into execution.

AI agents call tools.
Copilots trigger workflows.
CI/CD pipelines modify production.
Service accounts move data.
APIs execute financial and operational decisions.
MSPs and MSSPs act across customer environments.

Existing systems authenticate actors, assign permissions, and log activity. They do not define a portable protocol for establishing whether an autonomous actor is trustworthy enough to be relied on in a specific context.

TTP defines that missing layer.

OAuth standardized delegated access.
SCIM standardized identity provisioning.
TTP standardizes trustworthiness establishment before autonomous execution.

## Stack Alignment

TTP establishes trustworthiness.
SCIM-RE structures runtime trust context.
RAP evaluates authority.
Execution Exchange enforces downstream decisions.
CortexTrace records evidence and receipts.

```text
TTP -> SCIM-RE -> RAP -> Execution Exchange -> Protected Systems
 |
 v
CortexTrace
 |
 v
ExecutionReceipts
```

TTP does not govern execution directly.
TTP establishes trustworthiness.
Downstream runtime authority systems decide and enforce what happens next.

## Add Trustworthiness to Your Agents

Your agents already know how to act.
TTP helps prove whether they are trustworthy enough to be relied on.

Bring your existing agents.
No agent rewrite required.
No IdP replacement required.
No workflow migration required.

Add an evidence-backed trustworthiness layer around your agents, tools, APIs, workflows, and non-human identities.

```text
Agent identity -> trust evidence -> TTP trust proof -> authority evaluation -> downstream decision -> receipt
```

| Step | What you do | What TTP provides |
| --- | --- | --- |
| 1. Register the actor | Define the agent, service account, API client, pipeline, or workflow as a Subject | Establishes who or what is being evaluated |
| 2. Attach evidence | Add trust claims, attestations, issuer context, freshness rules, and decay behavior | Establishes whether trust is current and evidence-backed |
| 3. Generate a trust proof | Evaluate the trust context before downstream authority decisions | Produces proof that RAP, Execution Exchange, API gateways, or CI gates can use |

Register the subject.
Attach evidence.
Evaluate trust.
Produce proof.

Keep your agents, copilots, APIs, IdPs, and workflows.
Add an evidence-backed trustworthiness layer before downstream authority and enforcement.

## Developer Quickstart

```bash
git clone https://github.com/BlockSiFr/ttp-protocol.git
cd ttp-protocol
npm install
npm test
npm run ttp -- check examples/01-basic-agent.ttp
npm run ttp -- eval examples/02-trust-decay.ttp --subject agent:invoice_reviewer --at now
```

Expected check output:

```json
{
  "ok": true,
  "file": "examples/01-basic-agent.ttp",
  "subjects": 1,
  "trust_claims": 1,
  "proofs": 1,
  "authority_contexts": 1,
  "delegations": 0
}
```

Expected eval output shape:

```json
{
  "subject": "agent:invoice_reviewer",
  "effective_score": 0,
  "required_score": 0.7,
  "result": "TRUST_PROOF_EXPIRED",
  "reason": "trust claim expired before evaluation",
  "proof_mode": "cleartext-dev",
  "evaluated_at": "2026-06-25T18:27:15.881Z",
  "expires_at": "2026-05-11T20:00:00.000Z",
  "receipt_hash_optional": null
}
```

First trust proof path:

```bash
npm run demo
```

The demo prints reference decisions, trust scores, and ExecutionReceipt identifiers for local non-production scenarios.

## Protocol Primitives

| Primitive | Meaning |
| --- | --- |
| Subject | The human, agent, service account, pipeline, API client, workload, or workflow whose trustworthiness is being evaluated. |
| TrustClaim | A scoped statement that a Subject has a trust score or trust state issued by a specific trust issuer. |
| TrustIssuer | The entity responsible for issuing or attesting to a TrustClaim. |
| AuthorityGrant | A bounded right or delegated authority context that may only be relied on when trust, freshness, scope, and constraints are satisfied. |
| Attestation | Fresh evidence that the subject, credential, workload, code, runtime, or operating context remains valid. |
| TrustDecay | The time-based weakening of trust when fresh evidence or attestations are absent. |
| Delegation | The bounded transfer of trust or authority context from one subject, issuer, or workflow to another. |
| TrustProof | A structured proof that trust conditions were evaluated and satisfied or not satisfied. |
| RuntimeDecision | A downstream enforceable decision derived from trustworthiness, authority, evidence, and context. |
| ExecutionReceipt | A signed proof object recording the evaluated subject, action, resource, decision, trust state, authority basis, evidence references, timestamp, and receipt chain context. |

## What TTP Establishes

| Actor | Trustworthiness question | TTP role |
| --- | --- | --- |
| AI agent | Is this agent trustworthy enough for this tool, data, or workflow context? | Evaluates trust claims, attestations, scope, and decay |
| Copilot | Is this delegated action backed by current trust evidence? | Binds trust proof to the requested action context |
| CI/CD pipeline | Is this workload trustworthy enough to promote, deploy, or alter infrastructure? | Evaluates trust before downstream CI/CD gates act |
| API client | Is this client trustworthy enough for this sensitive endpoint? | Supplies trust context to gateway or service decisioning |
| Service account | Is this non-human identity still trustworthy for its assigned task? | Detects stale, decayed, or unverified trust |
| MSP/MSSP operator | Is this customer-impacting action backed by current trust and evidence? | Produces trust proof for delegated operational action |

## Trust Proof Outcomes

TTP produces trust context and trust proof results.

| Trust proof outcome | Meaning |
| --- | --- |
| trust_valid | Current trust evidence satisfies the proof requirement |
| trust_insufficient | Effective trust is below the required threshold |
| trust_expired | Trust claim or proof freshness has expired |
| trust_invalid | Syntax, issuer, evidence, reference, or proof validation failed |
| trust_unknown | Trustworthiness cannot be established from available evidence |

## Downstream Runtime Decisions

Runtime authority systems may convert trust proof results into enforceable decisions.

| Runtime decision | Meaning |
| --- | --- |
| allow | Execution may proceed |
| throttle | Execution may proceed under rate, volume, or scope limits |
| step_up | Fresh attestation or additional approval is required |
| escalate | Human or higher-authority review is required |
| deny | Execution is blocked |

TTP itself establishes trustworthiness.
RAP, Execution Exchange, API gateways, CI gates, and integrated runtime systems enforce downstream decisions.

## Integration Paths

| Integration path | Best for | How it works |
| --- | --- | --- |
| Agent trust wrapper | LangChain, CrewAI, MCP tools, custom agents, OpenAI tools, Claude tools | Wrap the agent or tool boundary with a trust proof |
| API trust check | Sensitive APIs, SaaS actions, service-to-service calls | Supply trust context before the gateway or service relies on the actor |
| CI/CD trust proof | GitHub Actions, Azure DevOps, GitLab, Terraform, deployment workflows | Establish trustworthiness before merge, deploy, promote, or infrastructure change |
| MSP/MSSP trust proof | ServiceNow, Jira, ConnectWise, Sentinel, Defender, remediation, decommissioning | Prove customer-impacting work is backed by current trust evidence |

First trust proof in minutes.
Production enforcement with Execution Exchange when ready.

## Why It Matters

| Buyer | Value |
| --- | --- |
| CISO | Establish whether autonomous actors are trustworthy before downstream authority systems rely on them |
| CTO | Deploy agents and automation without losing confidence in who or what can be trusted |
| Compliance | Convert trust evaluations and downstream decisions into evidence |
| Platform engineering | Add trust proof checks to APIs, CI/CD, agent tools, and workflows |
| MSP/MSSP | Prove customer-impacting actions were backed by current trust evidence |
| Identity team | Extend identity context into dynamic trustworthiness |
| Security engineering | Detect stale, decayed, or unverified trust before sensitive reliance |

## Open Protocol, Commercial Enforcement

Open source TTP includes protocol grammar, trustworthiness semantics, the trust proof model, public schemas, example `.ttp` files, SDK primitives, a reference evaluator, non-production demo gates, public ExecutionReceipt schemas, public AuthorityGrant schemas, public Attestation schemas, the TrustDecay model, documentation, RFCs, and example integrations.

Commercial BlockSiFr capabilities include Execution Exchange runtime enforcement, managed Runtime Authority Gate, production RAP service, tenant governance infrastructure, HSM-backed signing, production ExecutionReceipt ledger, CortexTrace enterprise evidence engine, CAIF / IFC optimization engine, enterprise adapters, compliance evidence packs, customer policy templates, behavioral scoring weights, risk-cost-compliance scoring model, managed service control plane, enterprise trust graph, enterprise evidence exports, production policy orchestration, and customer-specific baselines.

TTP establishes trustworthiness.
Execution Exchange enforces downstream runtime decisions in production.
CortexTrace records and verifies execution evidence and receipts.

See [COMMERCIAL_BOUNDARY.md](COMMERCIAL_BOUNDARY.md) for the explicit boundary.

## Security Posture

TTP is currently a protocol draft and reference implementation.

Do not use cleartext-dev proof mode in production.

Production trustworthiness establishment and downstream enforcement require:

* trusted issuer registry
* signed claims
* replay protection
* clock integrity
* key rotation
* tenant isolation
* fail-closed downstream enforcement
* receipt signing
* audit retention
* policy review
* evidence integrity
* attestation freshness
* secure key management
* protected commercial control plane

BlockSiFr Execution Exchange provides commercial production enforcement capabilities.

## Repository Map

| Path | Purpose |
| --- | --- |
| [examples/](examples/) | `.ttp` examples and non-production trust proof demos |
| [src/](src/) | MVP parser, evaluator, and CLI |
| [spec/](spec/) and [specs/](specs/) | Protocol notes, schemas, and reference contracts |
| [docs/concepts/](docs/concepts/) | Concept documentation for trustworthiness establishment |
| [docs/integrations/](docs/integrations/) | Integration notes for agents, CI/CD, gateways, and MSP/MSSP workflows |
| [docs/enterprise/](docs/enterprise/) | Enterprise security model, threat model, deployment, and commercial boundary notes |
| [rfcs/](rfcs/) | Protocol RFC structure |

## Build the Trustworthiness Layer

TTP is open protocol infrastructure.

Use it to model trust.
Use it to evaluate evidence.
Use it to establish trustworthiness.
Use it to produce proof.

Use Execution Exchange when trust proof must drive production runtime enforcement.
