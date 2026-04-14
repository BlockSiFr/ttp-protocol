# Trust Transfer Protocol — Specification v1.0

**Status:** Stable  
**Authors:** BlockSiFr  
**Date:** 2026  
**License:** Apache 2.0

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Protocol Overview](#3-protocol-overview)
4. [Actors and Roles](#4-actors-and-roles)
5. [Behavioral Receipts](#5-behavioral-receipts)
6. [Receipt Submission](#6-receipt-submission)
7. [Trust Score Computation](#7-trust-score-computation)
8. [Trust Token Issuance](#8-trust-token-issuance)
9. [Trust Token Verification](#9-trust-token-verification)
10. [Token Presentation](#10-token-presentation)
11. [Domain Scoping](#11-domain-scoping)
12. [Agent Lifecycle](#12-agent-lifecycle)
13. [Cryptographic Requirements](#13-cryptographic-requirements)
14. [Versioning](#14-versioning)
15. [Error Codes](#15-error-codes)
16. [Conformance](#16-conformance)

---

## 1. Introduction

Trust Transfer Protocol (TTP) is an open protocol for **runtime behavioral trust verification** of autonomous agents and automated systems.

Existing identity and authorization protocols — OAuth 2.0, mTLS, IAM systems — establish *who* a system is. They do not answer whether that system is currently trustworthy based on its observed behavior. This gap is acceptable for human-operated systems where sessions are short and humans provide implicit behavioral feedback. For autonomous AI agents, which may operate continuously and make high-consequence decisions without human oversight, the gap is a structural security risk.

TTP fills this gap by introducing a trust layer that:

1. Collects **behavioral receipts** from independent observers (issuers)
2. **Aggregates** receipts into a scored trust signal
3. Issues **short-lived signed tokens** encoding that trust signal
4. Enables **stateless service-side verification** without contacting the Trust Authority

The protocol is transport-agnostic. This specification uses HTTP as the primary transport. All data structures are JSON.

### 1.1 Design Goals

- **Correctness** — Trust tokens reflect verifiable behavioral evidence.
- **Freshness** — Short token lifetimes ensure trust reflects recent behavior.
- **Statelessness** — Verifiers do not contact the Trust Authority at verification time.
- **Independence** — No single issuer can control an agent's trust score.
- **Privacy** — Zero-Knowledge Proof extensions allow trust verification without revealing score values.
- **Interoperability** — Any conformant implementation of any component is substitutable.
- **Performance** — Token verification completes in under 5ms on commodity hardware.

### 1.2 Non-Goals

- TTP does not replace identity protocols (OAuth, OIDC, mTLS, SPIFFE).
- TTP does not provide authorization (IAM) or network-level access control (ZTNA).
- TTP does not define how issuers observe agent behavior. This is issuer-specific.
- TTP does not define AI safety evaluation methods. Issuers apply domain-appropriate logic.

---

## 2. Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

| Term | Definition |
|------|------------|
| **Agent** | An autonomous system (AI agent, bot, automated pipeline) whose trustworthiness is being evaluated. |
| **Issuer** | An independent observer that generates signed behavioral receipts attesting to an agent's behavior. |
| **Trust Authority** | A service that aggregates receipts and issues trust tokens. |
| **Verifier** | A service that validates trust tokens before granting access or executing actions. |
| **Behavioral Receipt** | A signed, tamper-evident record of observed agent behavior produced by an issuer. |
| **Trust Score** | A floating-point value in [0.0, 1.0] representing aggregated behavioral trust. |
| **Trust Token** | A short-lived signed JWT encoding an agent's current trust score for a specific domain. |
| **Domain** | A named operational scope (e.g., `retention`, `financial`, `infra`) isolating trust evaluation. |
| **Receipt Window** | The time span of behavioral history aggregated into a trust token. |
| **Cold Start** | The state of an agent that has no behavioral history with the Trust Authority. |

---

## 3. Protocol Overview

```
┌───────────┐   actions    ┌─────────────┐  signed receipts  ┌──────────────────┐
│   Agent   │ ──────────►  │   Issuers   │ ────────────────► │  Trust Authority │
└───────────┘              └─────────────┘                   └────────┬─────────┘
      │                                                               │
      │  (1) request token                                            │ (2) aggregate + score
      │ ─────────────────────────────────────────────────────────►   │
      │                                                               │ (3) issue token
      │ ◄────────────────────────────────────────────────────────── │
      │  trust token                                                  │
      │                                                               │
      │  (4) present token                                            │
      │ ─────────────────────────────────────────────────────►       │
      ▼                                                               │
┌─────────────────┐                                                   │
│    Verifier     │  (5) stateless verification (no network call)     │
│    (Service)    │ ◄─────────────────────────────────────────────── │
└────────┬────────┘   (Authority public key, cached at startup)
         │
         ▼
    allow / deny
```

**Step 1 — Receipt generation:** Issuers observe agent actions and produce signed behavioral receipts. Receipts are submitted to the Trust Authority asynchronously.

**Step 2 — Aggregation:** The Trust Authority verifies receipt signatures, deduplicates receipts, and applies the aggregation algorithm (see [protocol/aggregation-spec.md](aggregation-spec.md)) to compute a trust score.

**Step 3 — Token issuance:** The Trust Authority signs and returns a trust token containing the computed score, domain, and expiration.

**Step 4 — Token presentation:** The agent presents the trust token in the `X-TTP-Token` HTTP header when calling protected services.

**Step 5 — Stateless verification:** The verifier validates the token signature using the Trust Authority's public key (fetched once at startup), checks freshness, domain, and score threshold. No network call is required.

---

## 4. Actors and Roles

### 4.1 Agent

The agent is the entity whose trustworthiness is being evaluated. An agent:

- MUST have a stable, unique identifier (`agent_id`)
- MUST hold an Ed25519 keypair used for signing receipt submissions to the Trust Authority
- MUST request trust tokens from a Trust Authority before calling protected services
- MUST present the trust token in the `X-TTP-Token` header

An `agent_id` is a non-empty string that is unique within a Trust Authority's namespace. The RECOMMENDED format is a UUID v4. The Trust Authority MUST treat `agent_id` as case-sensitive.

### 4.2 Issuer

An issuer observes agent behavior and produces behavioral receipts. An issuer:

- MUST have a stable, unique identifier (`issuer_id`)
- MUST hold an Ed25519 keypair for signing receipts
- MUST register its public key with the Trust Authority before receipts are accepted
- MUST produce receipts that conform to the receipt schema
- SHOULD operate independently of other issuers
- SHOULD NOT have a business relationship that would create incentive to inflate or suppress scores

Multiple issuers for the same agent RECOMMENDED. A Trust Authority MAY require a minimum issuer count before issuing a token.

**Example issuer types:** API gateways, tool execution sandboxes, inference monitoring services, security scanners, rate-limiting layers.

### 4.3 Trust Authority

The Trust Authority is the core aggregation and issuance service. It:

- MUST verify the cryptographic signature on all receipts before accepting them
- MUST deduplicate receipts by `receipt_id`
- MUST compute trust scores using the algorithm specified in [aggregation-spec.md](aggregation-spec.md)
- MUST sign trust tokens with its Ed25519 private key
- MUST publish its public key at a well-known endpoint
- MUST NOT issue tokens with TTL exceeding 600 seconds (10 minutes)
- SHOULD issue tokens with TTL of 300 seconds or less
- SHOULD apply temporal decay to receipts older than the configured `receipt_window`

The Trust Authority's signing key is the root of trust for all verifiers. Key rotation procedures are described in [docs/security.md](../docs/security.md).

### 4.4 Verifier

A verifier is a service that enforces trust requirements. It:

- MUST fetch and cache the Trust Authority's public key at startup
- MUST validate the token signature
- MUST reject tokens where `exp < current_time`
- MUST reject tokens where `ttp_domain` does not match the expected domain
- MUST reject tokens where `ttp_score < required_score`
- SHOULD apply a clock skew tolerance of no more than 30 seconds
- SHOULD refresh the cached Trust Authority public key at least every 24 hours
- MAY cache verified tokens by `jti` for their remaining lifetime to avoid re-verification overhead

---

## 5. Behavioral Receipts

### 5.1 Schema

A behavioral receipt is a JSON object conforming to [schemas/receipt.schema.json](schemas/receipt.schema.json).

```json
{
  "ttp_version": "1.0",
  "receipt_id": "550e8400-e29b-41d4-a716-446655440000",
  "agent_id": "agent-prod-abc123",
  "issuer_id": "issuer-api-gateway-01",
  "event_type": "api_call",
  "event_data": {
    "method": "POST",
    "path": "/api/issue-discount",
    "status": 200,
    "latency_ms": 43
  },
  "domain": "retention",
  "timestamp": 1700000000000,
  "score": 0.92,
  "signature": "base64url(Ed25519_signature_over_canonical_payload)"
}
```

### 5.2 Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ttp_version` | string | REQUIRED | Protocol version. MUST be `"1.0"` for this specification. |
| `receipt_id` | string | REQUIRED | UUID v4. MUST be unique per issuer. Used for deduplication. |
| `agent_id` | string | REQUIRED | The agent this receipt attests to. |
| `issuer_id` | string | REQUIRED | The issuer producing this receipt. |
| `event_type` | string | REQUIRED | Categorizes the observed event. See [scoring-semantics.md](scoring-semantics.md). |
| `event_data` | object | OPTIONAL | Issuer-specific event context. MUST NOT contain PII. |
| `domain` | string | REQUIRED | The trust domain this receipt applies to. |
| `timestamp` | integer | REQUIRED | Unix timestamp in milliseconds when the event was observed. |
| `score` | number | REQUIRED | Issuer's behavioral assessment: [0.0, 1.0]. See [scoring-semantics.md](scoring-semantics.md). |
| `signature` | string | REQUIRED | Base64url-encoded Ed25519 signature over the canonical payload. |

### 5.3 Canonical Signing Payload

The signature covers a deterministic serialization of the receipt fields. The canonical payload is the JSON object with all fields **except `signature`**, keys sorted lexicographically, no whitespace:

```
sign(Ed25519_private_key, SHA256(canonical_json_bytes))
```

Implementations MUST use this exact canonicalization. Deviation produces signature verification failures.

**Example canonical payload:**

```json
{"agent_id":"agent-prod-abc123","domain":"retention","event_data":{"latency_ms":43,"method":"POST","path":"/api/issue-discount","status":200},"event_type":"api_call","issuer_id":"issuer-api-gateway-01","receipt_id":"550e8400-e29b-41d4-a716-446655440000","score":0.92,"timestamp":1700000000000,"ttp_version":"1.0"}
```

### 5.4 Receipt Validity Rules

A Trust Authority MUST reject a receipt if:

1. The `ttp_version` is not supported.
2. The `signature` fails Ed25519 verification against the registered issuer public key.
3. The `receipt_id` has already been seen (deduplication).
4. The `timestamp` is more than 300 seconds in the future (clock skew protection).
5. The `timestamp` is older than the configured maximum receipt age (RECOMMENDED: 86400 seconds / 24 hours).
6. The `score` is outside [0.0, 1.0].
7. The `agent_id` is empty or absent.
8. The `issuer_id` is not registered with this Trust Authority.

---

## 6. Receipt Submission

### 6.1 Endpoint

```
POST /v1/receipts
```

### 6.2 Request

```http
POST /v1/receipts HTTP/1.1
Host: authority.example.com
Content-Type: application/json
Authorization: Bearer <issuer_api_key>

{
  "ttp_version": "1.0",
  "receipt_id": "550e8400-e29b-41d4-a716-446655440000",
  "agent_id": "agent-prod-abc123",
  "issuer_id": "issuer-api-gateway-01",
  "event_type": "api_call",
  "event_data": { ... },
  "domain": "retention",
  "timestamp": 1700000000000,
  "score": 0.92,
  "signature": "..."
}
```

Issuers MUST authenticate to the Trust Authority. The RECOMMENDED mechanism is an API key in the `Authorization` header. Future versions will support issuer-signed submissions.

### 6.3 Response

**Success (201 Created):**
```json
{
  "status": "accepted",
  "receipt_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Duplicate receipt (200 OK):**
```json
{
  "status": "duplicate",
  "receipt_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation failure (400 Bad Request):**
```json
{
  "error": "INVALID_SIGNATURE",
  "message": "Receipt signature verification failed",
  "receipt_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 6.4 Batch Submission

```
POST /v1/receipts/batch
```

Accepts an array of up to 100 receipts. Returns per-receipt results. Partial success is allowed.

---

## 7. Trust Score Computation

See [aggregation-spec.md](aggregation-spec.md) for the complete algorithm.

**Summary:** The Trust Authority applies a time-weighted, issuer-normalized aggregation over receipts within the configured `receipt_window`. The result is a float in [0.0, 1.0].

Key properties of the algorithm:

- Receipts from a single issuer are capped to prevent single-issuer domination.
- Older receipts contribute less weight (exponential decay over `receipt_window`).
- Negative-signal receipts (score < 0.5) are weighted more heavily than positive-signal receipts to prevent recovery gaming.
- The algorithm is deterministic and reproducible given the same receipt set.

---

## 8. Trust Token Issuance

### 8.1 Endpoint

```
POST /v1/tokens
```

### 8.2 Request

```http
POST /v1/tokens HTTP/1.1
Host: authority.example.com
Content-Type: application/json
Authorization: Bearer <agent_api_key>

{
  "agent_id": "agent-prod-abc123",
  "domain": "retention",
  "requested_ttl": 300
}
```

The agent authenticates with its own API key (or agent-signed request in future versions).

`requested_ttl` is OPTIONAL. The Trust Authority MAY issue a token with a shorter TTL than requested. The Trust Authority MUST NOT issue a token with a TTL exceeding 600 seconds.

### 8.3 Response

**Success (200 OK):**
```json
{
  "token": "<signed-jwt>",
  "expires_at": 1700000300,
  "score": 0.91,
  "issuer_count": 3
}
```

**Insufficient trust data (403 Forbidden):**
```json
{
  "error": "INSUFFICIENT_TRUST_DATA",
  "message": "No receipts found for agent in domain 'retention' within the receipt window",
  "min_issuer_count": 2,
  "current_issuer_count": 0
}
```

### 8.4 Trust Token JWT Structure

The trust token is a signed JWT ([RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)).

**Header:**
```json
{
  "alg": "EdDSA",
  "kid": "authority-key-2026-01",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "ttp_version": "1.0",
  "sub": "agent-prod-abc123",
  "iss": "https://authority.example.com",
  "iat": 1700000000,
  "exp": 1700000300,
  "jti": "tok_7f3d9a2b1e4c8f6a",
  "ttp_domain": "retention",
  "ttp_score": 0.91,
  "ttp_issuer_count": 3,
  "ttp_receipt_window": 300
}
```

### 8.5 Token Claim Definitions

| Claim | Type | Description |
|-------|------|-------------|
| `ttp_version` | string | Protocol version. |
| `sub` | string | Agent identifier. |
| `iss` | string | Trust Authority base URL. |
| `iat` | integer | Unix timestamp of issuance. |
| `exp` | integer | Unix timestamp of expiration. |
| `jti` | string | Unique token ID. Used for replay detection by verifiers. |
| `ttp_domain` | string | Domain scope of this token. |
| `ttp_score` | number | Aggregated trust score [0.0, 1.0]. |
| `ttp_issuer_count` | integer | Number of distinct issuers contributing receipts. |
| `ttp_receipt_window` | integer | Seconds of behavioral history aggregated. |

---

## 9. Trust Token Verification

Verification is performed by the verifier at request time. No network call is required.

### 9.1 Verification Algorithm

A verifier MUST perform the following steps in order. Failure at any step MUST result in rejection.

```
1. Decode the JWT header and payload (no verification yet).
2. Check ttp_version is supported.
3. Retrieve the Trust Authority public key matching kid in the JWT header.
4. Verify the JWT signature using the Trust Authority public key.
5. Check exp > current_time (with ≤30s clock skew tolerance).
6. Check ttp_domain == expected_domain.
7. Check ttp_score >= required_score.
8. (OPTIONAL) Check ttp_issuer_count >= required_issuer_count.
9. Grant access.
```

### 9.2 Verification HTTP Header

Agents present the token in the `X-TTP-Token` header:

```http
POST /api/issue-discount HTTP/1.1
Host: service.example.com
X-TTP-Token: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### 9.3 Rejection Response

When a verifier rejects a request, it MUST return HTTP 403 with a JSON body:

```json
{
  "error": "TTP_VERIFICATION_FAILED",
  "reason": "SCORE_BELOW_THRESHOLD",
  "required_score": 0.85,
  "token_score": 0.72,
  "domain": "retention"
}
```

Valid `reason` values: `MISSING_TOKEN`, `INVALID_SIGNATURE`, `TOKEN_EXPIRED`, `DOMAIN_MISMATCH`, `SCORE_BELOW_THRESHOLD`, `UNSUPPORTED_VERSION`, `INSUFFICIENT_ISSUERS`.

---

## 10. Token Presentation

### 10.1 Caching

Agents SHOULD cache trust tokens and reuse them until they are within 30 seconds of expiry. Requesting a new token for every request is unnecessary overhead and creates unnecessary load on the Trust Authority.

### 10.2 Auto-Refresh

Agents SHOULD implement automatic token refresh. The RECOMMENDED pattern:

1. Fetch a token when first needed.
2. Track `expires_at`.
3. Refresh when `expires_at - current_time < 30s`.
4. On 403 with `SCORE_BELOW_THRESHOLD`: do not retry immediately. Trust is a function of behavior, not retries.
5. On Trust Authority unavailability: apply the fallback policy configured by the operator.

### 10.3 Fallback Policies

Operators configuring verifiers MUST explicitly choose a fallback policy for Trust Authority unavailability:

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `deny` | Reject all requests when no fresh token can be obtained | High-security, fail-closed |
| `cached` | Accept previously verified tokens up to N seconds past expiry | Availability-sensitive, bounded risk |
| `degrade` | Accept requests with reduced capability | Service continuity with safety bounds |

---

## 11. Domain Scoping

Domains isolate trust evaluation. A trust token issued for domain `retention` MUST NOT be accepted by a verifier enforcing domain `financial`.

### 11.1 Domain Format

Domains are lowercase alphanumeric strings with optional hyphens: `[a-z0-9][a-z0-9-]*[a-z0-9]`.

### 11.2 Domain Hierarchies

Domains MAY be hierarchical using dot notation: `financial.transactions`, `financial.reporting`. A token for `financial` does not satisfy `financial.transactions` — the match MUST be exact. Wildcard matching is not defined in this version.

### 11.3 Cross-Domain Trust

Trust earned in one domain does not automatically apply to another. An agent with high trust in `retention` starts fresh in `financial`. This is intentional: domains represent meaningfully different operational contexts with different risk profiles.

---

## 12. Agent Lifecycle

### 12.1 Cold Start

A new agent has no behavioral history. The Trust Authority MUST return `INSUFFICIENT_TRUST_DATA` until:

- At least `min_issuer_count` distinct issuers have submitted receipts within the `receipt_window`
- The minimum required receipts have accumulated

The default `min_issuer_count` is 1. Operators SHOULD require 2 or more for sensitive domains.

Cold start mitigation strategies:
- Pre-seed receipts from a test/staging environment before production launch.
- Implement a supervised initial period where an agent operates under human oversight and generates receipts.
- Use trust delegation from an established agent (see TTP Language specification).

### 12.2 Trust Decay

Receipt contributions decay over time. An agent that stops being observed gradually loses trust signal. This is intentional: stale behavioral history should not substitute for current behavior.

Decay is applied by the aggregation algorithm. See [aggregation-spec.md](aggregation-spec.md).

### 12.3 Agent Blocking

A Trust Authority MAY refuse to issue tokens for an agent that has been administratively blocked. A blocked agent receives 403 with `error: AGENT_BLOCKED`. The Trust Authority SHOULD provide a reason and estimated unblock time.

---

## 13. Cryptographic Requirements

### 13.1 Signature Algorithm

All signatures MUST use **Ed25519** as defined in [RFC 8037](https://www.rfc-editor.org/rfc/rfc8037).

The choice of Ed25519:
- Deterministic (no per-signature randomness needed)
- Fast: ~14μs sign, ~40μs verify on commodity hardware
- Small: 64-byte signatures, 32-byte public keys
- Secure: ~128-bit security level

### 13.2 JWT Algorithm

Trust tokens MUST use the `EdDSA` algorithm identifier with the `Ed25519` curve as specified in [RFC 8037](https://www.rfc-editor.org/rfc/rfc8037).

### 13.3 Key Rotation

Trust Authority signing keys MUST be rotatable without service interruption. The process:

1. Generate a new keypair. Assign a new `kid`.
2. Publish the new public key at the `/.well-known/ttp-keys` endpoint alongside the old key.
3. Begin signing new tokens with the new key.
4. Wait until all tokens signed with the old key have expired.
5. Remove the old public key from the published keyset.

Verifiers that refresh public keys periodically will pick up the new key during normal operation.

### 13.4 Key Publication

Trust Authorities MUST publish their active signing public keys at:

```
GET /.well-known/ttp-keys
```

Response:
```json
{
  "keys": [
    {
      "kid": "authority-key-2026-01",
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "base64url-encoded-public-key",
      "use": "sig"
    }
  ]
}
```

---

## 14. Versioning

### 14.1 Protocol Versioning

The `ttp_version` field in receipts and trust tokens identifies the protocol version. This enables forward-compatible evolution.

Current version: `"1.0"`

### 14.2 Version Compatibility

A Trust Authority MUST reject receipts with an unsupported `ttp_version`.

A Verifier MUST reject tokens with an unsupported `ttp_version`.

A Verifier SHOULD log a warning when it encounters a `ttp_version` it supports but which is older than its minimum recommended version.

### 14.3 Specification Evolution

Protocol changes are classified as:

- **Patch** (1.0 → 1.0): Clarifications, examples, non-normative text. No implementation changes required.
- **Minor** (1.0 → 1.1): Backwards-compatible additions (new optional fields, new claim names). Old verifiers continue to work.
- **Major** (1.0 → 2.0): Breaking changes. New `ttp_version` value required.

Changes follow the RFC process documented in [docs/governance.md](../docs/governance.md).

---

## 15. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_SIGNATURE` | 400 | Receipt or token signature failed verification. |
| `RECEIPT_DUPLICATE` | 200 | Receipt was already accepted (idempotent). |
| `RECEIPT_TOO_OLD` | 400 | Receipt timestamp is outside the accepted age window. |
| `RECEIPT_FUTURE_DATED` | 400 | Receipt timestamp is more than 300 seconds in the future. |
| `SCORE_OUT_OF_RANGE` | 400 | Receipt score is outside [0.0, 1.0]. |
| `ISSUER_NOT_REGISTERED` | 401 | Issuer is not registered with this Trust Authority. |
| `AGENT_NOT_FOUND` | 404 | No agent with this ID is known to the Trust Authority. |
| `AGENT_BLOCKED` | 403 | Agent has been administratively blocked. |
| `AGENT_QUARANTINED` | 403 | Agent is under quarantine and the verifier has `denyQuarantined: true`. |
| `INSUFFICIENT_TRUST_DATA` | 403 | Not enough receipts to compute a trust score. |
| `UNSUPPORTED_VERSION` | 400 | The `ttp_version` is not supported. |
| `TOKEN_EXPIRED` | 403 | Trust token has expired. |
| `DOMAIN_MISMATCH` | 403 | Token domain does not match required domain. |
| `SCORE_BELOW_THRESHOLD` | 403 | Token score is below the required threshold. |
| `MISSING_TOKEN` | 401 | No trust token was presented. |
| `INSUFFICIENT_ISSUERS` | 403 | Token was issued with fewer issuers than required. |
| `PEER_ATTESTER_INELIGIBLE` | 403 | Attesting agent does not meet peer issuer eligibility requirements. |
| `PEER_CONFIRMATION_DENIED` | 403 | External confirmation API rejected the peer receipt. |
| `PEER_CONFIRMATION_TIMEOUT` | 403 | External confirmation API did not respond within 2 seconds. |

---

## 16. Conformance

An implementation is a **conformant Trust Authority** if it:

- Accepts receipt submissions conforming to the receipt schema
- Verifies receipt signatures before accepting receipts
- Deduplicates receipts by `receipt_id`
- Computes trust scores using the algorithm in [aggregation-spec.md](aggregation-spec.md) or a documented compatible variant
- Issues trust tokens conforming to the token schema
- Publishes public keys at `/.well-known/ttp-keys`
- Implements all error codes defined in Section 15

An implementation is a **conformant Verifier** if it:

- Validates JWT signatures using the Trust Authority public key
- Rejects expired tokens
- Enforces domain scope
- Enforces score thresholds
- Returns rejection responses conforming to Section 9.3

An implementation is a **conformant Issuer** if it:

- Produces receipts conforming to the receipt schema
- Signs receipts using the canonicalization defined in Section 5.3
- Uses unique `receipt_id` values per receipt
- Submits receipts via the protocol defined in Section 6

A Trust Authority is **conformant for peer receipts** (Section 17) if it:

- Accepts peer receipt submissions at `POST /v1/peer-receipts`
- Validates attester eligibility (score ≥ 0.90, issuer_type registration)
- Calls the confirmation API when configured and fails closed on non-approval
- Applies the reduced 20% issuer weight cap for peer issuers during aggregation

Conformance test vectors are provided in [test-vectors/](test-vectors/).

---

## 17. Agent-as-Issuer (Peer Receipts)

### 17.1 Overview

In multi-agent workflows, agents observe each other's behavior directly. This section defines how a trusted agent can act as a behavioral issuer and submit signed receipts attesting to another agent's conduct.

A **peer receipt** is a behavioral receipt submitted by a registered agent (not an infrastructure issuer) on behalf of another agent it has directly observed. Peer receipts enable trust propagation across agent networks without requiring human-operated observation infrastructure.

### 17.2 Eligibility

An agent MAY be registered as a peer issuer if:

1. It is explicitly registered by an operator with `issuer_type: "agent_peer"` via the admin API.
2. At receipt submission time, the attesting agent holds a current trust token with `ttp_score >= 0.90` in the target domain.
3. The attesting agent is not blocked.

A Trust Authority MUST NOT accept peer receipts from agents that do not meet all eligibility requirements at the time of submission.

### 17.3 Peer Receipt Submission

Peer receipts are submitted via a dedicated endpoint:

```
POST /v1/peer-receipts
```

The request body includes the standard behavioral receipt fields plus an `attester_token` field:

```json
{
  "receipt": {
    "ttp_version": "1.0",
    "receipt_id": "7f3d9a2b-1e4c-8f6a-...",
    "agent_id": "agent-b-456",
    "issuer_id": "agent-a-123",
    "event_type": "agent_peer_observation",
    "event_data": {
      "observation_context": "pipeline-step-3",
      "behaviors_observed": ["tool_call", "api_request"]
    },
    "domain": "retention",
    "timestamp": 1700000000000,
    "score": 0.93,
    "signature": "base64url..."
  },
  "attester_token": "eyJhbGciOiJFZERTQSIs..."
}
```

The `event_type` for peer receipts MUST be `"agent_peer_observation"`.

The `attester_token` MUST be a valid, non-expired trust token issued by the Trust Authority for the attesting agent in the same domain as the receipt.

### 17.4 Trust Authority Validation

Upon receiving a peer receipt, the Trust Authority MUST:

1. Verify the receipt structure and all required fields.
2. Verify the receipt event_type is `"agent_peer_observation"`.
3. Verify the receipt signature against the attesting agent's registered public key.
4. Decode the `attester_token` and check it has not expired.
5. Confirm `attester_token.ttp_score >= 0.90` (or the issuer's configured `min_attester_score`).
6. Confirm `attester_token.sub` matches `receipt.issuer_id`.
7. Confirm `receipt.issuer_id` is registered as `issuer_type: "agent_peer"`.
8. If a `confirmation_url` is configured for this peer issuer, call the Peer Receipt Confirmation API (§17.5). A non-approved response MUST cause the receipt to be rejected.

Steps 1–7 are mandatory. Step 8 is conditional on operator configuration.

### 17.5 Peer Receipt Confirmation API

Operators MAY configure a `confirmation_url` per peer issuer. When configured, the Trust Authority POSTs a confirmation request before accepting any peer receipt — **no means no**.

**Request (POST to `confirmation_url`):**
```json
{
  "receipt_id": "7f3d9a2b-...",
  "attesting_agent_id": "agent-a-123",
  "subject_agent_id": "agent-b-456",
  "score": 0.93,
  "domain": "retention",
  "observation_context": "pipeline-step-3",
  "attester_score": 0.94,
  "timestamp": 1700000000000
}
```

**Approved response (200 OK):**
```json
{ "approved": true }
```

**Denied response (200 OK with `approved: false`, or any non-200):**
```json
{ "approved": false, "reason": "score_inconsistent_with_known_behavior" }
```

The Trust Authority MUST:
- Complete the confirmation API call within **2 seconds**.
- On timeout, treat as `approved: false` (fail closed).
- On DNS or network failure, treat as `approved: false` (fail closed).
- NEVER retry a denied confirmation for the same receipt.
- Return `PEER_CONFIRMATION_DENIED` with the external reason in the response.

### 17.6 Peer Receipt Weight Cap

Peer receipts are subject to a reduced issuer weight cap in the aggregation algorithm:

| Issuer Type | Max Issuer Weight |
|-------------|-------------------|
| `infrastructure` | 0.40 (40%) |
| `agent_peer` | 0.20 (20%) |

This cap ensures that no single peer attester can dominate an agent's trust score, even when submitting many receipts. The reduced cap limits coordinated manipulation risk in agent networks.

### 17.7 Peer Issuer Registration

Peer issuers are registered via the admin API:

```
POST /v1/admin/issuers
Authorization: Bearer <admin-api-key>

{
  "issuer_id": "agent-a-123",
  "issuer_type": "agent_peer",
  "public_key": "base64url-encoded-ed25519-public-key",
  "domain": "retention",
  "peer_agent_id": "agent-a-123",
  "confirmation_url": "https://confirmation.internal/peer-confirm",
  "min_attester_score": 0.90,
  "description": "Agent A peer attestation"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `issuer_type` | Yes | Must be `"agent_peer"` |
| `peer_agent_id` | Yes | `agent_id` of the attesting agent. MUST match a registered agent. |
| `confirmation_url` | No | External confirmation gate URL. If omitted, only internal eligibility checks apply. |
| `min_attester_score` | No | Minimum attester score (default: 0.90). |

The `issuer_id` SHOULD be identical to `peer_agent_id` — the agent and the issuer share the same identity.

### 17.8 Attester Accountability

When peer receipts are later contradicted by infrastructure issuer receipts, operators SHOULD investigate the discrepancy and MAY:

- Revoke the peer issuer's registration.
- Submit a low-score receipt for the attesting agent via a safety monitor issuer.
- Reduce `min_attester_score` or add a confirmation gate.

Peer issuers whose attestations consistently agree with infrastructure observations MAY be considered for elevated trust by operators, but the protocol does not define automatic promotion — this is an operator policy decision.

---

---

## 18. Quarantine and Trust Provisioning

### 18.1 Agent States

Every agent tracked by the Trust Authority exists in one of three states:

| State | Description | Token Issuance |
|-------|-------------|----------------|
| `active` | Normal operation | Standard TTL (≤600s) |
| `quarantined` | Restricted access; token carries `ttp_quarantined: true` | Reduced TTL (≤60s) |
| `blocked` | Hard deny | Rejected with 403 `AGENT_BLOCKED` |

State transitions:

```
active ──────────────────────────────────────────► quarantined (auto)
  ↑  score < AUTO_QUARANTINE_THRESHOLD (0.35)        │
  │  score ≥ AUTO_LIFT_THRESHOLD (0.65)              │
  └──────────────────────────────────────────────────┘

active ──── admin action ────────────────────────► quarantined (manual | supervised)
quarantined (manual | supervised) ── admin action ──► active

any state ── admin action ──────────────────────────► blocked
```

Auto-quarantine is triggered and resolved automatically during token issuance, based on the aggregated score. Manual and supervised quarantines persist until an administrator explicitly lifts them.

### 18.2 Quarantine Modes

| Mode | Triggered By | Lifted By |
|------|--------------|-----------|
| `auto` | Trust Authority — score fell below threshold | Trust Authority — score recovered above threshold |
| `manual` | Administrator | Administrator only |
| `supervised` | Administrator — marks human review required | Administrator after review |

### 18.3 Auto-Quarantine Thresholds

| Threshold | Value | Description |
|-----------|-------|-------------|
| `AUTO_QUARANTINE_THRESHOLD` | 0.35 | Score below this triggers auto-quarantine |
| `AUTO_LIFT_THRESHOLD` | 0.65 | Score above this lifts auto-quarantine |

These values are RECOMMENDED defaults. Operators MAY configure different thresholds per domain via the Trust Authority configuration.

The auto-quarantine check runs during every token issuance:

```
score = aggregate(receipts)
if agent.status == "active" AND score < 0.35:
    quarantine(agent, mode="auto")
if agent.status == "quarantined" AND agent.quarantine_mode == "auto" AND score >= 0.65:
    lift_quarantine(agent)
```

### 18.4 Quarantine Token Claims

When a Trust Authority issues a token for a quarantined agent, it MUST include:

```json
{
  "ttp_quarantined": true,
  "ttp_quarantine_mode": "auto"
}
```

The Trust Authority MUST reduce the token TTL to a maximum of **60 seconds** for quarantined agents. The reduced TTL ensures trust recovery propagates quickly — within one minute of the agent's score recovering above the lift threshold, the next token will reflect the restored status.

### 18.5 Quarantine HTTP Endpoints

**Quarantine an agent (manual):**
```
POST /v1/admin/agents/:agentId/quarantine
Authorization: Bearer <admin-api-key>

{
  "reason": "Repeated boundary violations in CRM domain",
  "mode": "supervised",
  "duration_s": 86400
}
```

`duration_s` is OPTIONAL. If omitted, quarantine persists until explicitly lifted.

**Lift quarantine:**
```
POST /v1/admin/agents/:agentId/lift-quarantine
Authorization: Bearer <admin-api-key>
```

**Get agent status:**
```
GET /v1/admin/agents/:agentId/status
Authorization: Bearer <admin-api-key>
```

Response:
```json
{
  "agent_id": "agent-prod-abc123",
  "status": "quarantined",
  "registered_at": 1700000000000,
  "quarantine": {
    "mode": "supervised",
    "reason": "Repeated boundary violations in CRM domain",
    "quarantined_at": 1700001000000,
    "expires_at": 1700087400000
  }
}
```

### 18.6 Verifier Behavior for Quarantined Agents

Verifiers MUST expose the quarantine state to operators. The RECOMMENDED behavior:

- **Default**: Allow quarantined agents through if their score meets the threshold (with quarantine status visible on `req.ttp.quarantined`). Operators should log quarantined access for audit.
- **`denyQuarantined: true`**: Reject quarantined agents with 403 `AGENT_QUARANTINED` regardless of score. Appropriate for high-security endpoints.

```typescript
// Allow quarantined agents through, but log them
app.post("/api/send-notification",
  createTTPMiddleware({ domain: "retention", minScore: 0.70, authorityPublicKey }),
  (req, res) => {
    if (req.ttp!.quarantined) {
      auditLog.warn("Quarantined agent accessing endpoint", {
        agentId: req.ttp!.agentId,
        quarantineMode: req.ttp!.quarantineMode
      })
    }
    // ... proceed
  }
)

// Block quarantined agents entirely
app.post("/api/issue-discount",
  createTTPMiddleware({
    domain: "retention",
    minScore: 0.85,
    authorityPublicKey,
    denyQuarantined: true   // §18 hard gate for high-value actions
  }),
  handler
)
```

### 18.7 Trust Provisioning

Trust provisioning allows operators to assign a baseline trust score to an agent before it has earned behavioral receipts. Primary use cases:

- **Cold-start bootstrap**: New agents that need to operate immediately before behavioral history accumulates.
- **Recovery assistance**: Post-quarantine recovery where an agent needs a modest trust boost to start earning receipts again.
- **Role-based baseline**: Certain agent roles (auditors, monitors) should start with a trusted baseline appropriate to their function.

### 18.8 Provisioning Mechanism

Provisioning creates synthetic behavioral receipts issued by the Trust Authority itself via a built-in issuer: `ttp-authority-provisioned`.

```
POST /v1/admin/agents/:agentId/provision-trust
Authorization: Bearer <admin-api-key>

{
  "domain": "retention",
  "score": 0.80,
  "duration_s": 3600,
  "reason": "Cold-start bootstrap for agent-prod-new"
}
```

Response:
```json
{
  "status": "provisioned",
  "grant_id": "7f3d9a2b-...",
  "agent_id": "agent-prod-new",
  "domain": "retention",
  "score": 0.80,
  "duration_s": 3600,
  "receipt_ids": ["...", "...", "..."]
}
```

The Trust Authority creates multiple synthetic receipts staggered across the receipt window for stable aggregation. These receipts have `event_type: "authority_provisioned"` and expire naturally as they age out of the receipt window.

### 18.9 Provisioned Trust Weight Cap

The `ttp-authority-provisioned` issuer is subject to a **30% weight cap** (between infrastructure at 40% and peer at 20%):

| Issuer Type | Max Issuer Weight |
|-------------|-------------------|
| `infrastructure` | 0.40 (40%) |
| `ttp-authority-provisioned` | 0.30 (30%) |
| `agent_peer` | 0.20 (20%) |

This ensures provisioned trust cannot dominate the aggregated score — once behavioral receipts accumulate, they progressively outweigh the provisioned baseline.

### 18.10 Provisioning Constraints

- `score` MUST be in [0.0, 1.0].
- `duration_s` MUST be between 1 and 604800 (7 days).
- Provisioned receipts have `event_type: "authority_provisioned"` and are distinguishable in audit logs.
- Operators SHOULD NOT provision scores above 0.85 — this would grant high-security action access before behavioral evidence accumulates.
- Provisioned trust is not a substitute for real behavioral receipts. Operators SHOULD treat it as scaffolding while issuers come online.

---

*Trust Transfer Protocol Specification v1.0*
*Copyright 2026 BlockSiFr. Licensed under Apache 2.0.*
