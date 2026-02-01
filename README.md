```markdown
# Trust Transfer Protocol (TTP)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Spec Version](https://img.shields.io/badge/Spec-v1.5-orange)](spec/rfc0001.md)

**TTP** is an open protocol for runtime trust qualification in autonomous agent systems.

TTP enables systems to verify the trustworthiness of an interacting entity *at the moment of request*, based on observable behavioral history aggregated by independent issuers. It breaks the "blind trust transfer" model of traditional IAM by requiring trust to be continuously re-earned through signed interaction receipts.

TTP is deliberately minimal, transport-agnostic, and infrastructure-oriented:
- No blockchains, tokens, or economic layers.
- Built on standard JWT (RFC 7519) with Ed25519 signatures.
- Primary binding: HTTP `Authorization: Trust` scheme for seamless enforcement.

## Why TTP Exists

Traditional credential systems (OAuth scopes, API keys, session tokens) delegate authority once and assume perpetual alignment. This works for deterministic software but fails for nondeterministic agents that can be prompt-injected, hallucinate, or deviate.

TTP inserts a lightweight verification gate at every hop, asking:
> "Given this entity's cumulative behavior, is this specific action trustworthy right now?"

This enables secure scaling of high-autonomy agents in production.

## Key Properties

- **Behavioral Trust**: Scores derived from interaction receipts and endorsements.
- **Runtime Enforcement**: Short-lived tokens (≤1 hour) with consensus scores (0–100).
- **Multi-Domain Scoring**: Context-specific trust (e.g., research vs. payments).
- **Decentralized Observation**: Independent issuers; aggregation resists compromise.
- **Developer-Friendly**: Declarative policies, automatic token handling via SDKs.
- **Secure by Design**: Minimal attack surface, short lifetimes, statistical anomaly resistance.

## Repository Structure

```
/spec                  # Protocol specification
  └── rfc0001.md       # Core spec (v1.5)
/reference             # Reference implementations
  └── go               # Verifier + minimal issuer (high-performance, production-ready)
/sdk                   # Client libraries
  ├── python           # Agent-side SDK (LangChain integration example)
  └── js               # JavaScript/TypeScript SDK
/examples              # Usage examples
  ├── langchain        # TTP-protected tool calls
  └── http-gateway     # Nginx/Express middleware
/docs                  # Additional documentation
  └── whitepaper.md    # Problem statement and design rationale
```

## Quick Start

### Run the Reference Verifier (Go)

```bash
git clone https://github.com/ttp-protocol/ttp.git
cd ttp/reference/go/verifier
go run main.go --port 8080
```

### Example Request

```bash
curl -H "Authorization: Trust eyJhbGciOiJFZERTQSIs..." https://api.example.com/sensitive
```

### Python SDK (Agent-Side)

```python
from ttp.sdk.python import TTPClient

client = TTPClient(issuer_urls=["https://issuer1.example.com", "https://issuer2.example.com"])
token = client.get_token(min_score=70, domain="research")

# Automatically attach to tool calls in LangChain, etc.
```

## Specification

Full details in [`/spec/rfc0001.md`](spec/rfc0001.md).

Highlights:
- Token format and claims
- Verification and aggregation endpoints
- Interaction receipt primitive
- HTTP Authorization binding

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md).

Priorities:
- Framework integrations (LangChain, CrewAI, LlamaIndex)
- Additional SDKs (Java, Rust)
- Public issuer deployments
- Security audits and fuzzing

Issues labeled `good first issue` are great entry points.

## Governance

Lightweight working group model. Spec changes require consensus among active maintainers.

## License

Apache License 2.0 – permissive and enterprise-friendly.

## Contact & Community

- Open an issue for discussions.
- Early adopters: Reach out for partnership on hosted verifiers or enterprise integrations.

TTP is built for the agent era: secure, scalable, and open.

Let's make runtime trust the default.
```
