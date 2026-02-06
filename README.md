Trust Transfer Protocol (TTP)

TTP is an open protocol for runtime trust verification in autonomous systems.

It allows a service to evaluate whether an agent should be trusted right now, based on verifiable behavioral history issued by independent observers.

Instead of granting static permissions (API keys, OAuth scopes, sessions), TTP enforces trust continuously — at every request.

⸻

The Problem

Autonomous agents introduce a new failure mode:
	•	prompt injection
	•	hallucinated reasoning
	•	tool misuse
	•	drifting behavior over time

Traditional identity and access systems assume deterministic software and static authorization.

Agents are neither.

TTP replaces “trust once, use forever” with:

“Verify trust at the moment of action.”

⸻

What TTP Does

TTP introduces a lightweight verification layer:
	•	behavioral receipts signed after interactions
	•	independent issuers observing performance
	•	aggregation into a runtime trust score
	•	short-lived tokens proving trustworthiness
	•	enforcement directly at API and tool boundaries

No chains.
No tokens.
No reputation platforms.

Just verifiable behavioral trust.

⸻

Core Properties

Behavioral Trust
Scores derived from real interaction history and endorsements.

Runtime Enforcement
Short-lived tokens (≤1 hour) evaluated per request.

Contextual Trust Domains
Trust varies by domain: research ≠ payments ≠ deployment.

Decentralized Observation
Independent issuers reduce manipulation and central failure.

Developer-First
SDK-managed tokens, declarative policy thresholds.

Secure by Design
Ed25519 signatures, minimal state, small attack surface.

⸻

Architecture Overview

Agent → Issuers → Aggregator → Verifier → Protected Service
        (receipts)  (scores)     (policy)     (enforcement)

TTP sits between identity and execution.

It answers:
	•	Has this agent behaved reliably?
	•	In this domain?
	•	Recently?
	•	Verified by whom?
	•	Above this risk threshold?

⸻

Repository Structure

/spec
  └── rfc0001.md       # Protocol specification

/reference
  └── go               # Verifier + minimal issuer

/sdk
  ├── python           # Agent SDK (LangChain example)
  └── js               # JS/TS SDK

/examples
  ├── langchain
  └── http-gateway

/docs
  └── whitepaper.md


⸻

Quick Start

1) Run the Verifier

git clone https://github.com/ttp-protocol/ttp.git
cd ttp/reference/go/verifier
go run main.go --port 8080

2) Make a Protected Request

curl \
  -H "Authorization: Trust eyJhbGciOiJFZERTQSIs..." \
  https://api.example.com/sensitive

3) Generate a Token (Python)

from ttp.sdk.python import TTPClient

client = TTPClient(
    issuer_urls=[
        "https://issuer1.example.com",
        "https://issuer2.example.com"
    ]
)

token = client.get_token(
    min_score=70,
    domain="research"
)

SDKs automatically attach tokens to agent tool calls.

⸻

Specification

Full protocol details:
/spec/rfc0001.md

Includes:
	•	token structure + claims
	•	receipt model
	•	issuer responsibilities
	•	aggregation rules
	•	verifier policy engine
	•	HTTP Authorization binding

⸻

Where TTP Fits

TTP complements — not replaces:
	•	OAuth
	•	API gateways
	•	service meshes
	•	agent frameworks

Identity answers who you are.
TTP answers whether you’re trustworthy right now.

⸻

Contributing

We’re actively building the ecosystem.

High-impact areas:
	•	LangChain / CrewAI / LlamaIndex integrations
	•	additional SDKs (Rust, Java)
	•	issuer implementations
	•	verification performance
	•	adversarial testing + fuzzing
	•	production deployment patterns

Start with issues labeled good first issue.

See: CONTRIBUTING.md

⸻

Governance

Spec-driven development with maintainer consensus.

Focus:
	•	minimal core
	•	strong interoperability
	•	multiple independent implementations

⸻

Security

Security-first design priorities:
	•	stateless verification
	•	short token lifetimes
	•	issuer diversity
	•	anomaly resistance
	•	verifiable signatures

Security reviews and audits are welcomed.

⸻

License

Apache 2.0 — permissive for commercial and enterprise adoption.

⸻

Community
	•	Issues → design discussion
	•	PRs → implementations
	•	Early adopters → integrations

TTP is being built as neutral infrastructure for the agent ecosystem.

⸻

Vision

Agents will coordinate across organizations, networks, and environments.

Trust cannot live inside platforms.

It must be:
	•	portable
	•	verifiable
	•	privacy-preserving
	•	open

TTP is the runtime trust layer for autonomous systems.