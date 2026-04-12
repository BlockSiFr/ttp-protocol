# TTP Architecture Guide

This document describes the architecture of a TTP deployment: how components fit together, deployment topologies, and design decisions.

---

## Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TTP DEPLOYMENT                                          │
│                                                                                  │
│  ┌──────────────┐     actions      ┌──────────────────────────────────────────┐ │
│  │              │ ─────────────►   │            ISSUERS                       │ │
│  │    AGENT     │                  │  ┌──────────────┐  ┌──────────────────┐  │ │
│  │              │                  │  │ API Gateway  │  │ Inference Monitor│  │ │
│  │  (autonomous │                  │  │   Issuer     │  │     Issuer       │  │ │
│  │   system)    │                  │  └──────┬───────┘  └────────┬─────────┘  │ │
│  │              │                  │         │                   │            │ │
│  └──────┬───────┘                  │  ┌──────┴───────┐          │            │ │
│         │                          │  │ Tool Runtime │          │            │ │
│         │ request token            │  │   Issuer     │          │            │ │
│         │                          │  └──────┬───────┘          │            │ │
│         ▼                          └─────────┼───────────────────┼────────────┘ │
│  ┌──────────────────┐                        │ signed receipts   │              │
│  │                  │ ◄──────────────────────┘───────────────────┘              │
│  │  TRUST AUTHORITY │                                                            │
│  │                  │  issues short-lived                                        │
│  │  • verifies       │  signed JWT token                                         │
│  │    signatures     │ ────────────────────────────────────────────►             │
│  │  • deduplicates  │                                              │             │
│  │  • aggregates    │                                              │             │
│  │  • signs tokens  │                                              │             │
│  └──────────────────┘                                        agent presents      │
│                                                              token to service    │
│                                                                    │             │
│                                                                    ▼             │
│                                                         ┌──────────────────┐    │
│                                                         │    VERIFIER      │    │
│                                                         │  (inside service)│    │
│                                                         │                  │    │
│                                                         │ • validate sig   │    │
│                                                         │ • check expiry   │    │
│                                                         │ • check domain   │    │
│                                                         │ • check score    │    │
│                                                         └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flows

### Flow 1: Receipt Generation (Continuous)

Issuers run continuously, generating receipts as they observe agent behavior.

```
1. Agent performs an action (API call, tool execution, etc.)
2. Issuer observes the action and its outcome
3. Issuer computes a behavioral score for this event
4. Issuer creates a receipt with: agent_id, event_type, score, timestamp, domain
5. Issuer signs the receipt with its Ed25519 private key
6. Issuer POSTs the receipt to Trust Authority: POST /v1/receipts
7. Trust Authority verifies signature, deduplicates, stores receipt
```

Receipts are submitted **asynchronously** — the issuer does not block the agent's action waiting for TA acknowledgment.

### Flow 2: Token Issuance (On Demand)

Agents request tokens when they need to call a protected service.

```
1. Agent determines it needs to call a service protected by TTP domain "retention"
2. Agent checks its local token cache — no valid cached token exists
3. Agent POSTs to Trust Authority: POST /v1/tokens { agent_id, domain }
4. Trust Authority loads receipts for agent in domain within receipt_window
5. Trust Authority runs aggregation algorithm → trust_score
6. Trust Authority signs a JWT: { sub: agent_id, ttp_score, ttp_domain, exp: now+300 }
7. Trust Authority returns the signed JWT to the agent
8. Agent caches the token until near expiry
```

### Flow 3: Token Verification (Per Request)

Every request to a TTP-protected service triggers verification.

```
1. Agent calls service with X-TTP-Token: <jwt>
2. Verifier middleware intercepts the request
3. Verifier checks its local public key cache for the key matching jwt.header.kid
4. Verifier validates JWT signature
5. Verifier checks exp > now (with ≤30s clock skew)
6. Verifier checks ttp_domain == "retention"
7. Verifier checks ttp_score >= configured_threshold (e.g., 0.85)
8. If all checks pass: forward request to service handler
9. If any check fails: return 403 with error details
```

No network call is made in step 3-9. The public key is cached locally.

---

## Deployment Topologies

### Topology 1: Single-Tenant, Self-Hosted

Suitable for enterprises running their own AI agent infrastructure.

```
┌─────────────────────────── Enterprise Network ──────────────────────────┐
│                                                                          │
│  ┌─────────┐     ┌──────────────────────┐     ┌────────────────────┐   │
│  │  Agent  │────►│    Trust Authority   │────►│   Internal APIs    │   │
│  │ Fleet   │     │  (self-hosted)       │     │   (with Verifier   │   │
│  └─────────┘     │                      │     │    middleware)     │   │
│                  │  • single tenant     │     └────────────────────┘   │
│  ┌─────────┐     │  • enterprise HSM    │                              │
│  │ Issuers │────►│    for key storage   │                              │
│  │(gateway,│     │  • audit logging     │                              │
│  │monitor) │     └──────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Pros:** Full control, data residency, no external dependencies.  
**Cons:** Operational burden, requires internal expertise.

### Topology 2: Managed Trust Authority

Use BlockSiFr's hosted Trust Authority or a third-party managed service.

```
Enterprise:                        Cloud (Managed TA):
┌─────────────────────┐           ┌─────────────────────────┐
│  ┌─────────────┐    │           │                         │
│  │   Agents    │────┼──────────►│   Trust Authority       │
│  └─────────────┘    │           │   (managed service)     │
│                     │           │                         │
│  ┌─────────────┐    │           │  • HA deployment        │
│  │   Issuers   │────┼──────────►│  • HSM key storage      │
│  └─────────────┘    │           │  • SLA-backed           │
│                     │           │  • audit + compliance   │
│  ┌─────────────┐    │           └─────────────────────────┘
│  │  Services   │    │
│  │ (Verifiers) │    │
│  └─────────────┘    │
└─────────────────────┘
```

**Pros:** No operational burden for Trust Authority, managed SLA.  
**Cons:** External dependency, data sent to third party.

### Topology 3: Federated Trust Authorities

Multiple Trust Authorities operated by different organizations, with cross-authority trust federation (future protocol feature).

```
Organization A                    Organization B
┌──────────────────┐              ┌──────────────────┐
│  Trust Authority │◄────────────►│  Trust Authority │
│       (A)        │  federation  │       (B)        │
│                  │   protocol   │                  │
│  Agents in A     │              │  Agents in B     │
└──────────────────┘              └──────────────────┘
```

**Use case:** Multi-party AI agent marketplaces where agents from different organizations need to establish mutual trust.

**Status:** Planned for a future protocol version. See [ROADMAP.md](../ROADMAP.md).

---

## Trust Authority: Internal Architecture

A production Trust Authority deployment:

```
                    ┌─────────────────────────────────────────┐
                    │            Trust Authority               │
                    │                                         │
  Issuers ─────────►│  POST /v1/receipts                      │
                    │    → verify signature                   │
                    │    → deduplicate (Redis SET)            │
                    │    → store (PostgreSQL/DynamoDB)        │
                    │                                         │
  Agents ──────────►│  POST /v1/tokens                        │
                    │    → load receipts from DB              │
                    │    → run aggregation algorithm          │
                    │    → sign JWT (HSM/KMS)                 │
                    │    → return token                       │
                    │                                         │
  Verifiers ────────►│  GET /.well-known/ttp-keys              │
  (key refresh)     │    → return current public keyset       │
                    │                                         │
                    └─────────────────────────────────────────┘
                         │                    │
                         ▼                    ▼
                    ┌─────────┐          ┌─────────┐
                    │  Redis  │          │Postgres │
                    │ (dedup, │          │(receipts│
                    │ cache)  │          │ store)  │
                    └─────────┘          └─────────┘
```

### Persistence Requirements

| Data | Store | TTL |
|------|-------|-----|
| Accepted receipt IDs (dedup) | Redis SET | receipt_max_age (24h) |
| Receipt content | PostgreSQL / DynamoDB | receipt_window + buffer (e.g., 1 hour) |
| Issued token JTIs (replay) | Redis SET | token TTL |
| Issuer public keys | PostgreSQL | indefinite (managed) |

---

## Verifier: Integration Patterns

### Pattern 1: Express Middleware (TypeScript)

```typescript
import { createTTPMiddleware } from "@ttp/sdk"

app.use("/api/sensitive", createTTPMiddleware({
  domain: "financial",
  minScore: 0.90,
  authorityPublicKey: process.env.TTP_AUTHORITY_PUBLIC_KEY,
  minIssuerCount: 3,
  replayDetection: true
}))
```

### Pattern 2: Service Mesh (Envoy / Istio)

For polyglot environments, the TTP Verifier can run as a sidecar or Envoy external authorization filter:

```yaml
# Envoy ExtAuthz configuration
http_filters:
  - name: envoy.filters.http.ext_authz
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.ext_authz.v3.ExtAuthz
      grpc_service:
        envoy_grpc:
          cluster_name: ttp_verifier_sidecar
      transport_api_version: V3
      # TTP verifier sidecar runs locally, sub-millisecond latency
```

### Pattern 3: API Gateway Plugin

For Kong, AWS API Gateway, or Nginx, TTP verification can run as a plugin at the gateway layer, before requests reach any service.

See [examples/service-integration](../examples/service-integration/) for Kong and Nginx configurations.

---

## Performance Considerations

### Token Verification Latency

Ed25519 signature verification: ~0.04ms  
JWT parsing and claim inspection: ~0.1ms  
Total verifier overhead: **< 1ms** on commodity hardware (well under the 5ms target)

The bottleneck is not verification — it's token issuance (database reads, aggregation computation). This is amortized over the token TTL.

### Token Issuance Latency

| Component | Typical | P99 |
|-----------|---------|-----|
| Receipt DB read (window) | 5ms | 20ms |
| Aggregation computation | < 1ms | 2ms |
| Ed25519 signing (software) | < 1ms | 2ms |
| Ed25519 signing (HSM) | 3ms | 15ms |
| **Total (software key)** | **~6ms** | **~25ms** |
| **Total (HSM)** | **~9ms** | **~40ms** |

For a 300-second token TTL, each agent needs to call the TA approximately once every 4 minutes. A single TA instance can handle thousands of agents.

### Scaling

| Component | Scaling Strategy |
|-----------|-----------------|
| Trust Authority | Stateless behind load balancer; shared Redis + DB |
| Issuers | Scale independently per issuer type |
| Verifiers | Embedded in service; scales with service |
| Redis (dedup) | Redis Cluster for large deployments |
| PostgreSQL (receipts) | Read replicas for high-volume issuers |
