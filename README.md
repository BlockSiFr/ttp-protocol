# Trust Transfer Protocol (TTP)

TTP is an open protocol for deciding whether an autonomous system should be allowed to execute a protected action right now.

It fills the gap between **identity authentication** and **execution-time trustworthiness** by using signed behavioral evidence, trust routing, short-lived trust tokens, and verifiable execution receipts.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Spec](https://img.shields.io/badge/spec-v1.0-green.svg)](protocol/spec.md)
[![Status](https://img.shields.io/badge/status-active%20development-orange.svg)](docs/roadmap.md)

---

## Why Teams Adopt TTP

Autonomous agents can hold valid credentials while their behavior is stale, risky, compromised, or outside policy. TTP adds a runtime trust gate before high-impact actions such as production deploys, customer messaging, discount issuance, code changes, and tool execution.

Instead of asking only "who is calling?", TTP asks:

```text
Should this subject execute this action on this resource now?
```

The answer is explicit: `PERMIT`, `DENY`, `STEP_UP`, `THROTTLE`, or `CONSTRAIN`, with a receipt that can be audited later.

---

## Try It In 60 Seconds

Run the local trust-gate demo. It has no external dependencies and shows the core adoption wedge: a protected execution request is permitted, stepped up, or denied based on current trust evidence.

```bash
npm run demo
```

Expected shape:

```text
PERMIT trusted build action
decision: PERMIT
reason: route_valid

STEP_UP production deploy
decision: STEP_UP
reason: step_up_required

DENY revoked workload
decision: DENY
reason: revoked_subject
```

The demo is implemented in `examples/local-trust-gate-demo.mjs` and uses the routing engine in `packages/trust-routing-engine`.

---

## What TTP Is

- A protocol for **runtime trust decisions**.
- A receipt and token model for **stateless verification at service boundaries**.
- A way to combine evidence from **multiple independent issuers**.
- A trust-routing model for selecting a valid authority path before execution.
- A portable foundation for agent, workflow, and service governance.

## What TTP Is Not

- Not a replacement for OAuth/OIDC, IAM, SPIFFE, mTLS, ZTNA, or API gateways.
- Not a generic monitoring dashboard.
- Not a static policy-only system.
- Not a vendor-locked hosted service requirement.

---

## Core Flow

```text
execution request -> route resolution -> authority decision -> execution receipt -> enforcement
```

Concrete flow:

1. A subject requests a protected action.
2. Issuers provide signed behavioral evidence.
3. A Trust Authority or resolver evaluates route, score, freshness, scope, and policy.
4. The service receives a scoped decision.
5. Execution is permitted, denied, stepped up, throttled, or constrained.
6. An execution receipt records what happened and why.

---

## Core Concept

- Trust is evaluated at execution time, not only at login time.
- Receipts are signed and verifiable.
- Tokens are short-lived and domain-scoped.
- Services verify tokens statelessly.
- Trust can decay and recover based on recent behavior.
- Multi-issuer evidence reduces single-observer bias.

---

## How it works

```text
Agent -> Issuers -> Trust Authority -> Trust Token -> Service Verifier -> Execution
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

## Trust Routing Subsystem

TTP includes a runtime **Trust Routing** subsystem for trust-before-execution:

`execution request -> route resolution -> authority decision -> execution receipt -> enforcement`

Core implementation entry points:
- `apps/trust-route-resolver/src/server.mjs` (runtime APIs)
- `packages/trust-routing-engine/src/*` (resolver, decay, policy, receipt logic)
- `.github/workflows/governed-execution.yml` (GitHub Actions governed execution example)
- `examples/local-trust-gate-demo.mjs` (local permit/step-up/deny demo)

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

## Trust Routing subsystem

TTP includes Trust Routing for pre-execution authority-path resolution:

```text
execution request -> route resolution -> authority decision -> execution receipt -> enforcement
```

Key implementation entry points:

- `apps/trust-route-resolver/src/server.mjs`
- `packages/trust-routing-engine/src/*`
- `.github/workflows/governed-execution.yml`
- `examples/local-trust-gate-demo.mjs`

---

## What guarantees you get

- Cryptographic integrity of receipts and tokens.
- Time-bounded trust decisions.
- Domain isolation (trust does not automatically transfer across domains).
- Fail-closed decision model when trust requirements are not met.
- Stateless verification at service boundaries.

```
ttp-protocol/
├── protocol/
│   ├── spec.md              # Protocol specification
│   ├── schemas/             # JSON schemas
│   └── rfc/                 # Protocol RFCs
├── sdk/
│   └── typescript/          # TypeScript SDK foundation
├── examples/
│   ├── local-trust-gate-demo.mjs
│   ├── retention-platform-integration.md
│   ├── basic-agent/
│   ├── service-integration/
│   └── issuer-implementation/
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── governance.md
│   ├── patent-strategy.md
│   ├── integration-guide.md
│   ├── getting-started.md
│   ├── operator-guide.md
│   └── ecosystem-integrations.md
├── reference-implementations/
│   ├── trust-authority/
│   └── issuers/
└── README.md
```

---

## What you run

Reference components in this repo:

- Protocol + schemas: `protocol/`
- Trust Authority reference: `reference-implementations/trust-authority/`
- Issuer references: `reference-implementations/issuers/`
- Trust-route resolver demo: `apps/trust-route-resolver/`
- Trust-routing engine: `packages/trust-routing-engine/`

---

## What you integrate

Choose by role:

### Agent/runtime team

- Request domain-scoped trust tokens before sensitive actions.
- Pass token to protected downstream service.

### Service/API team

- Verify token per route.
- Enforce domain and minimum score.

### Platform/security team

- Operate Trust Authority.
- Register issuers and agents.
- Set thresholds and governance policy.

---

## Quickstart

### 1) Run the local trust-gate demo

```bash
npm run demo
```

This shows `PERMIT`, `STEP_UP`, and `DENY` decisions with execution receipts.

### 2) Run Trust Authority reference implementation

```bash
cd reference-implementations/trust-authority
npm install
npm run build
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

- Trust Authority / network core operations
- Issuer integrations and adapters
- Verifier enforcement patterns
- Agent SDK/runtime integrations
- Security analysis and threat modeling
- Documentation and onboarding

See <CONTRIBUTING.md> for guidelines.

-----

## Community

- **Discussions:** [GitHub Discussions](https://github.com/blocksifrdev/ttp-protocol/discussions)
- **Issues:** [GitHub Issues](https://github.com/blocksifrdev/ttp-protocol/issues)
- **Email:** hello@blocksifr.com
- **Twitter:** [@blocksifr](https://twitter.com/blocksifr)

-----

## Integration References

- Easy connect API: `docs/easy-connect-api.md`
- Runtime connect contract: `runtime/api/connect.contract.md`
- Full verification flow: `docs/integration-guide.md`

---

## GitHub self-governance (runtime authority for repo actions)

- Architecture: `docs/github-self-governance-reference-architecture.md`
- Protected action model: `docs/protected-action-model.md`
- Workflow contract: `docs/protected-gate-workflow-contract.md`

---

## Security, governance, and release readiness

- Security model: `docs/security.md`
- Security policy: `SECURITY.md`
- Contributing: `CONTRIBUTING.md`
- Public readiness checklist: `docs/public-readiness.md`
- Open-source boundary: `docs/open-source-boundary.md`
- Repo access control: `docs/repo-access-control.md`

---

## Related systems (complementary)

- OAuth/OIDC, IAM: identity and static authorization.
- SPIFFE/SPIRE, mTLS: workload identity/channel security.
- ZTNA: network access posture.
- API gateways/service mesh: traffic and connectivity controls.

TTP adds execution-time behavioral trust decisions on top of these layers.

---

## Project status

- Spec: `v1.0` (active development)
- TypeScript SDK: present
- Python/Go SDKs: planned

See `docs/roadmap.md`.

---

## License

Apache License 2.0. See `LICENSE`.

*Building the trust layer for autonomous systems.*
