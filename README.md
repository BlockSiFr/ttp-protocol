# Trust Transfer Protocol (TTP)

> **The behavioral trust layer for autonomous AI agents.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Spec](https://img.shields.io/badge/spec-v1.0-green.svg)](protocol/spec.md)
[![Status](https://img.shields.io/badge/status-active%20development-orange.svg)](ROADMAP.md)

---

Every security stack answers **"Who is this?"**

None of them answer **"Should this agent be trusted *right now*?"**

TTP answers that question — continuously, cryptographically, at execution time.

---

## The Problem

Your AI agents are authenticated. They have API keys, OAuth tokens, service accounts. Your IAM is configured correctly.

None of that tells you whether the agent running at this moment:

- Has been prompt-injected
- Is exhibiting behavioral drift
- Is operating within safe boundaries
- Has been compromised since it last authenticated

**Static credentials cannot answer dynamic trust questions.**

As autonomous agents gain the ability to execute financial transactions, modify production systems, trigger campaigns, and access sensitive data, the gap between *authenticated* and *trustworthy* becomes a critical attack surface.

## The Solution

TTP introduces **continuous, behavior-derived trust evaluation** as a first-class protocol primitive.

Instead of:

```
Authenticate once → Trust indefinitely
```

TTP enables:

```
Observe behavior → Compute trust → Issue short-lived token → Verify at execution
```

Trust becomes:

- **Time-bounded** — tokens expire in seconds, not hours
- **Behavior-derived** — scored from observed actions, not static credentials
- **Cryptographically verifiable** — signed evidence, stateless verification
- **Domain-scoped** — trust in one domain doesn't bleed into another
- **Continuously reevaluated** — good behavior earns trust; bad behavior slashes it

-----

## Core Concept

TTP replaces static trust with **continuous, behavior-derived trust evaluation.**

Instead of:

```
Authenticate once → Trust indefinitely
```

TTP enables:

```
Observe behavior → Compute trust → Issue short-lived token → Verify at execution
```

Trust becomes:

- Time-bounded
- Domain-scoped
- Cryptographically verifiable
- Continuously reevaluated

-----

## Architecture Overview

```
Agent → Issuers → Trust Authority → Trust Token → Service Verifier → Execution
```

Trust flow:

1. Agent performs actions
1. Independent issuers observe behavior
1. Issuers generate signed behavioral receipts
1. Trust Authority aggregates receipts and computes trust score
1. Trust Authority issues short-lived trust token
1. Agent presents token to service
1. Service verifies token and enforces policy
1. Access granted or denied

Verification at the service boundary is stateless and cryptographic.

-----

## Core Components

### Behavioral Receipts

Signed records of observed agent behavior.

Receipts contain:

- agent identity
- issuer identity
- event type
- timestamp
- domain
- behavioral score (optional)
- cryptographic signature

Receipts are tamper-evident and verifiable.

-----

### Independent Issuers

Issuers observe and attest to agent behavior.

Examples:

- API gateways
- Tool execution environments
- Inference gateways
- Security monitors
- Sandbox runtimes

Multiple issuers reduce manipulation risk.

-----

### Trust Authority

Aggregates receipts and issues trust tokens.

Responsibilities:

- Verify receipt signatures
- Aggregate behavioral evidence
- Compute trust score
- Issue short-lived trust tokens

Trust Authorities may be:

- Self-hosted
- Enterprise-hosted
- Provided as managed infrastructure

-----

### Trust Tokens

Short-lived cryptographically signed tokens containing:

- agent identity
- trust score
- domain scope
- issuance timestamp
- expiration timestamp

Services verify tokens before granting access.

Tokens expire quickly to ensure freshness.

-----

### Service Verifier

Service-side verification logic.

Verifies:

- Token signature
- Token freshness
- Domain scope
- Minimum trust score

Verification is stateless and fast.

-----

## Example Use Case: AI Retention Systems

Autonomous retention agents perform actions such as:

- Issuing discounts
- Triggering campaigns
- Sending customer messages

Without TTP:

Services trust agents based only on identity.

With TTP:

Services verify that the agent is currently trustworthy based on recent behavior.

Flow:

```
Retention Agent → Trust Authority → Trust Token → Service → Verified Execution
```

This enables safe autonomous retention.

See <examples/retention-platform-integration.md> for detailed integration guide.

-----

## Protocol Properties

### Runtime Trust Evaluation

Trust is evaluated continuously, not just at authentication.

-----

### Behavioral Trust

Trust derives from observed behavior, not static credentials.

-----

### Cryptographic Verification

Trust decisions are based on signed, verifiable evidence.

-----

### Stateless Enforcement

Services do not require access to behavioral history.

Trust tokens contain necessary verification data.

-----

### Domain Isolation

Trust is scoped to operational domains.

Trust in one domain does not automatically transfer to another.

-----

### Issuer Independence

Trust evidence may originate from multiple independent issuers.

-----

## Receipt Schema

Canonical receipt structure:

```json
{
  "ttp_version": "1.0",
  "receipt_id": "uuid-v4",
  "agent_id": "string",
  "issuer_id": "string",
  "event_type": "string",
  "event_data": {},
  "domain": "string",
  "timestamp": 1700000000000,
  "score": 0.92,
  "signature": "base64url-encoded-ed25519"
}
```

Signatures use Ed25519. The `ttp_version` field enables verifiers to apply the correct validation rules as the protocol evolves. See [protocol/schemas/receipt.schema.json](protocol/schemas/receipt.schema.json) for the full JSON Schema.

-----

## Trust Token Structure

JWT format with TTP-specific claims:

```json
{
  "ttp_version": "1.0",
  "sub": "agent_id",
  "iss": "trust_authority_id",
  "iat": 1700000000,
  "exp": 1700000300,
  "jti": "unique-token-id",
  "ttp_domain": "retention",
  "ttp_score": 0.91,
  "ttp_issuer_count": 3,
  "ttp_receipt_window": 300
}
```

Key claims:

- `ttp_version` — protocol version used to produce this token
- `ttp_score` — aggregated trust score (0.0–1.0)
- `ttp_issuer_count` — number of independent issuers contributing receipts
- `ttp_receipt_window` — seconds of behavioral history reflected in the score
- `jti` — unique token ID for replay detection

Tokens are short-lived. Recommended maximum TTL is 300 seconds. See [protocol/schemas/trust-token.schema.json](protocol/schemas/trust-token.schema.json) for the full JSON Schema.

-----

## Reference Implementation

Reference SDK provides:

- Agent token retrieval
- Receipt submission
- Service verification middleware

Example:

```typescript
import { TTPClient } from "@ttp/sdk"

const client = new TTPClient({
  agentId: "agent-1",
  privateKey: process.env.TTP_PRIVATE_KEY,
  authority: "https://api.ttp.network"
})

const token = await client.getTrustToken({
  domain: "retention"
})
```

Service verification:

```typescript
import { verifyTTPToken } from "@ttp/sdk"

app.post("/api/issue-discount", async (req, res) => {
  const token = req.headers["x-ttp-token"]
  
  const verification = await verifyTTPToken(token, {
    domain: "retention",
    minScore: 0.85
  })
  
  if (!verification.valid) {
    return res.status(403).json({ error: "Insufficient trust" })
  }
  
  // Execute action
  await issueDiscount(req.body)
  res.json({ success: true })
})
```

-----

## Quickstart (Simple Path)

If you want the fastest path from zero to first protected action:

1. **Run the Trust Authority** using the reference implementation.
1. **Register one agent + one issuer** using admin endpoints.
1. **Submit receipts** from your issuer as the agent performs actions.
1. **Request a trust token** from the agent.
1. **Verify token in your service** and enforce `minScore`.

Use this guide for full commands and environment setup:
- [docs/integration-guide.md](docs/integration-guide.md)

-----

## Integration Paths (Choose One)

### Path A — Agent builder
You own an autonomous agent and need runtime trust gating.

- Integrate `TTPClient` in the agent runtime.
- Request domain-scoped trust tokens before sensitive actions.
- Pass `X-TTP-Token` to downstream protected services.

### Path B — Service/API owner
You operate APIs and need behavior-aware authorization.

- Add TTP middleware or manual token verification.
- Configure per-route `domain` and `minScore` policies.
- Enforce deny/degrade/cached fallback by operation risk.

### Path C — Platform/security operator
You run shared infrastructure for many agents.

- Deploy and operate the Trust Authority.
- Register issuers and agents.
- Define score thresholds, quarantine policies, and domain boundaries.

-----

## Build the Network (Core -> Edge Participation Model)

TTP adoption works best when participants can join at different layers. You do **not** need to run everything on day one.

### Role 1 — Network Core Operator
Owns shared trust infrastructure for a domain/ecosystem.

- Stand up and operate a Trust Authority.
- Publish verification keys and operational policies.
- Curate issuer admission, diversity, and governance.

### Role 2 — Issuer Operator
Contributes signed behavioral evidence.

- Run one or more issuers (gateway, runtime, monitor, sandbox).
- Submit high-quality receipts with clear event semantics.
- Maintain independent operational control to reduce collusion risk.

### Role 3 — Verifier / Service Owner
Enforces trust at execution boundaries.

- Verify TTP tokens at API, tool, or workflow boundaries.
- Apply domain-specific `minScore` thresholds.
- Use fallback modes appropriate to business risk.

### Role 4 — Agent Builder / Integrator
Makes autonomous systems TTP-aware.

- Request short-lived trust tokens per domain.
- Present tokens to protected services.
- Tune behavior and controls using trust feedback loops.

### Start where you are

- If you're an enterprise platform team: start as **Network Core + Verifier**.
- If you're an infra/security vendor: start as **Issuer + Verifier**.
- If you're an agent framework/vendor: start as **Agent Builder + Issuer**.
- If you're a single product team: start as **Verifier**, then add issuer coverage.

This core-to-edge model lets the network expand outward without forcing every team to adopt every component at once.

-----

## Identity Assurance (Cover All Bases)

TTP must treat identity as an end-to-end discipline, not a single claim in a token.

- **Methodology:** define canonical `agent_id`, lifecycle states, and domain boundaries.
- **Workflow:** enforce registration, issuance controls, verification gates, and incident playbooks.
- **Code:** normalize identities, reject unknown principals early, enforce replay/clock protections.
- **Reasoning:** keep deterministic policy decisions and explicit threshold rationale per domain.

Use the full implementation checklist here:
- [docs/integration-guide.md#67-identity-gap-closure-checklist-methodology-workflow-code-reasoning](docs/integration-guide.md#67-identity-gap-closure-checklist-methodology-workflow-code-reasoning)

-----

## Agent Registry & Trust Operations (Reference API)

The reference Trust Authority includes admin endpoints that act as an operator-facing registry for known agents and operational trust state.

### Register known agents

```bash
curl -X POST http://localhost:3000/v1/admin/agents \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-retention-001",
    "description": "Retention agent for production"
  }'
```

### List known agents (+ optional metrics)

```bash
# Basic registry listing
curl -X GET http://localhost:3000/v1/admin/agents \
  -H "Authorization: Bearer $ADMIN_KEY"

# Include receipt-based metrics for a specific domain
curl -X GET "http://localhost:3000/v1/admin/agents?include_metrics=true&domain=retention" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

### Check agent status (active/quarantined/blocked)

```bash
curl -X GET http://localhost:3000/v1/admin/agents/agent-retention-001/status \
  -H "Authorization: Bearer $ADMIN_KEY"
```

### Quarantine or block when behavior degrades

```bash
# Quarantine (temporary)
curl -X POST http://localhost:3000/v1/admin/agents/agent-retention-001/quarantine \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"manual","reason":"investigating anomalous tool calls"}'

# Block (hard stop)
curl -X POST http://localhost:3000/v1/admin/agents/agent-retention-001/block \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason":"confirmed compromise"}'
```

### Capture trust score and behavior metrics

- Use `POST /v1/tokens` responses for **current trust score** and **issuer participation** (`score`, `issuer_count`).
- Use behavioral receipts as your event-level audit stream (`event_type`, `event_data`, `score`, `timestamp`).
- Build dashboards around score trend, issuer diversity, and domain-specific trust drift.

-----

## Repo Readiness Assessment (Intent, Onboarding, Integration)

This repository is structured to support the intended platform model (open protocol + reference implementation + integration docs):

- **Protocol clarity**: normative protocol and schemas under `protocol/`.
- **Integration docs**: architecture, security, and integration guidance under `docs/`.
- **Runnable reference stack**: trust authority and issuer reference implementations under `reference-implementations/`.
- **Practical examples**: starter integration examples under `examples/`.

Recommended next documentation improvements for onboarding at scale:

- Add an "operator runbook" with production SLOs, backup/restore, and incident workflows.
- Add a standard metrics spec for dashboards (score trend, quarantine rate, issuer coverage, replay rejects).
- Add a single-page "day-0 to day-30" rollout checklist for platform teams.

-----

## Where TTP Fits

|System         |Role                 |Relationship to TTP                                  |
|---------------|---------------------|-----------------------------------------------------|
|OAuth / OIDC   |Identity & authz     |Complementary — OAuth says *who*, TTP says *trustworthy now* |
|IAM            |Static permissions   |Complementary — IAM grants access, TTP continuously earns it |
|API Gateway    |Routing & rate limit |Integration point — gateway acts as an issuer        |
|Service Mesh   |Connectivity (mTLS)  |Complementary — mesh verifies identity, TTP verifies behavior |
|SPIFFE / SPIRE |Workload identity    |Complementary — SPIFFE issues SVIDs, TTP adds behavioral layer on top |
|Network Security Platforms (Zscaler, Palo Alto, Juniper) |Network/session controls|Complementary — network controls enforce transport/session policy; TTP enforces behavior-aware action trust |
|ZTNA           |Network access       |Complementary — ZTNA controls the network, TTP controls the action |
|AI Agent Frameworks | Execution      |Integration point — LangChain, CrewAI agents become TTP-aware |

TTP fills the gap between *authenticated* and *trustworthy*. It does not replace any layer in this stack — it adds the behavioral trust dimension that none of them provide.

-----

## Network-Level Agent Infrastructure (Zscaler, Palo Alto, Juniper)

Short answer:
- **Is it possible?** Yes.
- **Is it in this repo today as first-party connectors?** Not yet.
- **Is it a valid deployment pattern happening in practice?** Yes — via standard integration seams (gateways, identity, logs, policy engines).

Practical integration model:
1. Network/security platform observes session and policy events.
2. An issuer adapter converts those events into signed TTP receipts.
3. Trust Authority aggregates with other issuers (runtime, tool, API gateway).
4. Verifiers enforce action-level trust with TTP tokens at service boundaries.

This preserves clear responsibility layers:
- Network stack decides connection/session posture.
- TTP decides whether a specific autonomous action should execute now.

If you need vendor-specific blueprints, start with the issuer adapter pattern in the integration guide and implement per-vendor event mappers.

-----

## Security Model

Uses:

- Ed25519 signatures
- SHA-256 hashing
- Stateless verification
- Short-lived tokens

Resistant to:

- Token replay
- Signature forgery
- Tampering

-----

## Threat Model Considerations

Known challenges:

- Issuer collusion
- Behavioral manipulation
- Trust oscillation
- Observation gaps

Mitigations include:

- Issuer diversity
- Short token lifetime
- Domain isolation
- Multi-issuer requirements

See <docs/security.md> for detailed threat analysis.

-----

## Performance Goals

Designed for:

- High-volume verification
- Low-latency execution
- Stateless service enforcement

Verification requires only:

- Signature validation
- Token inspection

No network calls required.

Target latency: < 5ms for token verification.

-----

## Design Philosophy

TTP is built with:

- Minimal protocol surface
- Cryptographic trust guarantees
- Deployment flexibility
- Vendor neutrality
- Ecosystem openness

TTP is infrastructure.

-----

## Reference Architecture Diagram

```
┌─────────┐
│  Agent  │
└────┬────┘
     │ 1. Performs actions
     ▼
┌─────────────┐
│   Issuers   │ (API Gateway, Tool Runtime, Monitor)
└──────┬──────┘
       │ 2. Generate behavioral receipts
       ▼
┌──────────────────┐
│ Trust Authority  │
└────────┬─────────┘
         │ 3. Aggregate & compute trust
         ▼
    ┌─────────────┐
    │ Trust Token │ (short-lived, signed)
    └──────┬──────┘
           │ 4. Presented to service
           ▼
    ┌──────────────┐
    │   Service    │
    │  Verifier    │
    └──────┬───────┘
           │ 5. Stateless verification
           ▼
      ┌──────────┐
      │Execution │
      └──────────┘
```

-----

## Early Adopters & Use Cases

**Current Integration Targets:**

- Autonomous retention systems (campaign triggers, discount issuance)
- AI-powered customer service agents (multi-system access)
- Infrastructure automation agents (production changes)
- Financial services AI (transaction approval)

**In Development:**

- Reference integration with retention platforms
- Trust Authority hosted service (beta)
- SDK implementations (TypeScript, Python, Go)
- Open issuer implementations (API Gateway plugin, tool execution wrapper)

**Seeking Partners:**

- Retention platform vendors
- AI agent framework developers
- Enterprise security teams piloting autonomous systems
- Tool execution environment providers

**Benefits for Early Adopters:**

- Shape protocol evolution
- Integration support from core team
- Early access to hosted Trust Authority
- Case study and reference architecture development

If your platform could benefit from runtime trust verification, reach out: hello@blocksifr.com

-----

## Governance

Spec-driven evolution.

Independent implementations encouraged.

Protocol stability prioritized.

Changes follow RFC process documented in <docs/governance.md>.

Community feedback shapes roadmap.

-----

## Intellectual Property Notice

TTP is released under the **Apache License 2.0**, which includes an express patent grant from all contributors.

**What this means for implementers:**

- You may freely implement, deploy, and commercialize TTP-compliant software.
- The Apache 2.0 patent grant covers patents contributed by BlockSiFr that are necessarily infringed by the protocol specification itself.
- BlockSiFr has filed patent applications covering certain aggregation and scoring methods. These patents, if granted, will be licensed royalty-free to any party implementing the open protocol as specified in this repository.
- No royalties are required for open protocol implementation.

**What BlockSiFr commercializes:**

BlockSiFr offers managed Trust Authority infrastructure, enterprise compliance tooling, and SLA-backed hosted services. These are commercial products distinct from the open protocol.

The open protocol will never be encumbered to force adoption of BlockSiFr's commercial services.

See [docs/patent-strategy.md](docs/patent-strategy.md) for the full IP and commercialization model.

-----

## License

Apache License 2.0 — see [LICENSE](LICENSE) for full terms.

The Apache 2.0 license includes an express patent grant. See [Intellectual Property Notice](#intellectual-property-notice) for details on what this covers.

-----

## Repository Structure

```
ttp-protocol/
├── protocol/
│   ├── spec.md              # Protocol specification
│   ├── schemas/             # JSON schemas
│   └── rfc/                 # Protocol RFCs
├── sdk/
│   ├── typescript/          # TypeScript SDK
│   ├── python/              # Python SDK
│   └── go/                  # Go SDK
├── examples/
│   ├── retention-platform-integration.md
│   ├── basic-agent/
│   ├── service-integration/
│   └── issuer-implementation/
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── governance.md
│   ├── patent-strategy.md
│   └── integration-guide.md
├── reference-implementations/
│   ├── trust-authority/
│   ├── issuers/
│   └── verifiers/
└── README.md
```

-----

## Getting Started

**For Agent Developers:**

```bash
npm install @ttp/sdk
```

```typescript
import { TTPClient } from "@ttp/sdk"

const client = new TTPClient({
  agentId: "my-agent",
  privateKey: process.env.TTP_PRIVATE_KEY,
  authorityUrl: "https://authority.example.com"
})

// Get a trust token before calling a protected service
const token = await client.getTrustToken({ domain: "retention" })
```

See [examples/basic-agent](examples/basic-agent/) for the full quickstart.

**For Service Providers (verifying trust tokens):**

```typescript
import { createTTPMiddleware } from "@ttp/sdk"

app.use("/api/issue-discount", createTTPMiddleware({
  domain: "retention",
  minScore: 0.85,
  authorityPublicKey: process.env.TTP_AUTHORITY_PUBLIC_KEY
}))
```

See [docs/integration-guide.md](docs/integration-guide.md) for full verification setup.

**For Issuer Implementers:**

See [examples/issuer-implementation](examples/issuer-implementation/) for a reference issuer.

**For Trust Authority Operators:**

Self-hosted Trust Authority reference implementation: [reference-implementations/trust-authority](reference-implementations/trust-authority/)

```bash
cd reference-implementations/trust-authority
npm install
npm run generate-keys
npm start
```

-----

## Roadmap

**Phase 1: Foundation (Current)**

- Protocol specification v1.0
- TypeScript SDK
- Reference Trust Authority
- Retention platform integration examples

**Phase 2: Ecosystem**

- Python and Go SDKs
- Issuer reference implementations (API Gateway, Lambda, Kubernetes)
- Hosted Trust Authority beta
- Integration with major agent frameworks

**Phase 3: Enterprise**

- Enterprise Trust Authority features (audit, compliance, multi-tenant)
- Advanced threat detection
- Performance optimizations
- Governance framework maturity

**Phase 4: Standardization**

- Formal specification submission
- Multi-vendor implementations
- Industry adoption

See <docs/roadmap.md> for detailed timeline.

-----

## Contributing

Contributions welcome.

Areas of interest:

- SDK implementations
- Issuer integrations
- Security analysis
- Performance optimization
- Documentation

See <CONTRIBUTING.md> for guidelines.

-----

## Community

- **Discussions:** [GitHub Discussions](https://github.com/blocksifr/ttp-protocol/discussions)
- **Issues:** [GitHub Issues](https://github.com/blocksifr/ttp-protocol/issues)
- **Email:** hello@blocksifr.com
- **Twitter:** [@blocksifr](https://twitter.com/blocksifr)

-----

## Status

**Current:** Active development, protocol specification stable at v1.0

**SDK Status:**

- TypeScript: Beta
- Python: Planned
- Go: Planned

**Reference Implementations:**

- Trust Authority: Alpha
- API Gateway Issuer: Alpha
- Service Verifier: Beta

**Hosted Trust Authority:** Private beta (waitlist: hello@blocksifr.com)

Contributions welcome. Production use at your own risk during beta.

-----

## Comparison with Related Approaches

**vs. OAuth/OIDC:**
OAuth establishes *who* is making a request. TTP establishes *whether that identity should be trusted right now*, based on recent behavior. They are complementary: use OAuth to authenticate, then TTP to continuously authorize.

**vs. mTLS / Certificate-based Auth:**
A valid certificate proves cryptographic identity but says nothing about current behavior. An agent can hold a valid cert while exhibiting anomalous, manipulated, or unsafe behavior. TTP evaluates behavior, not just identity.

**vs. Traditional IAM:**
IAM grants static permissions that persist until revoked. TTP treats trust as continuously earned and automatically decayed. An agent that behaved well yesterday must continue to behave well today.

**vs. SPIFFE / SPIRE:**
SPIFFE issues cryptographic workload identities (SVIDs). TTP is a behavioral layer that sits on top of workload identity. The natural integration: SPIFFE identifies the agent, TTP certifies its current trustworthiness.

**vs. Zero Trust Network Access (ZTNA):**
ZTNA enforces network-level access policies. TTP enforces behavioral trust at the application and action level. An agent inside a ZTNA perimeter can still be behaviorally compromised.

**vs. API Rate Limiting:**
Rate limiting controls volume. An agent within rate limits can still be behaviorally dangerous. TTP evaluates whether the agent *should* be making requests at all, based on observed behavior patterns.

**vs. Anomaly Detection:**
Anomaly detection is reactive — it alerts after suspicious behavior occurs. TTP is preventive — it verifies behavioral trust *before* execution is permitted. Anomaly detection systems integrate naturally as TTP issuers.

-----

## FAQ

**Q: Is TTP a replacement for OAuth?**  
A: No. TTP is complementary. OAuth handles identity and authorization. TTP adds runtime behavioral trust verification.

**Q: Do I need to use BlockSiFr’s hosted Trust Authority?**  
A: No. The protocol is open. You can self-host the Trust Authority or use any compliant implementation.

**Q: What happens if the Trust Authority goes down?**  
A: Services can implement fallback policies (cached trust, degraded mode, deny-by-default). The protocol supports offline verification for recent tokens.

**Q: How is this different from anomaly detection?**  
A: Anomaly detection is reactive (alert after the fact). TTP is preventive (verify trust before execution). TTP can incorporate anomaly detection as an issuer signal.

**Q: Can agents game the system by behaving well until they act maliciously?**  
A: Short token lifetimes and multi-issuer requirements mitigate this. Trust scores reflect recent behavior. Domain isolation limits blast radius.

**Q: What’s the performance overhead?**  
A: Verification is stateless and fast (< 5ms target). Token issuance requires aggregation but agents can cache tokens for their validity period.

**Q: Is this only for AI agents?**  
A: No. TTP works for any autonomous system: bots, automated pipelines, services, etc. AI agents are the primary use case given their autonomy and unpredictability.

-----

## Citation

If you reference TTP in academic work or technical writing:

```
Trust Transfer Protocol: Open Protocol for Runtime Trust Verification in Autonomous AI Systems
BlockSiFr, 2026
https://github.com/blocksifr/ttp-protocol
```

-----

## Acknowledgments

TTP builds on concepts from:

- OAuth 2.0 and JWT standards
- Zero Trust Architecture (NIST SP 800-207)
- Behavioral attestation research
- Distributed systems trust models

We acknowledge the researchers and practitioners whose work informed this protocol.

-----

**Trust Transfer Protocol (TTP)**  
© 2026 BlockSiFr

Defining the infrastructure layer for trustworthy autonomous systems.

-----

## Quick Links

- [Protocol Specification](protocol/spec.md)
- [Aggregation Algorithm](protocol/aggregation-spec.md)
- [Scoring Semantics](protocol/scoring-semantics.md)
- [JSON Schemas](protocol/schemas/)
- [Test Vectors](protocol/test-vectors/)
- [Integration Guide](docs/integration-guide.md)
- [Security Threat Model](docs/security.md)
- [Architecture](docs/architecture.md)
- [TypeScript SDK](sdk/typescript/)
- [Reference Trust Authority](reference-implementations/trust-authority/)
- [Contributing](CONTRIBUTING.md)
- [Discussions](https://github.com/blocksifr/ttp-protocol/discussions)

-----

*Building the trust layer for autonomous systems.*
