# TTP Security Model and Threat Analysis

**Status:** Normative  
**Version:** 1.0

---

## Overview

This document describes the security model of the Trust Transfer Protocol, the threats it is designed to resist, known limitations, and recommended mitigations. TTP is security-critical infrastructure. This analysis should be treated as a living document, updated as new attack patterns are discovered.

---

## 1. Security Properties

### 1.1 What TTP Guarantees

When correctly deployed with conformant implementations:

1. **Receipt authenticity** — A behavioral receipt cannot be forged without access to the issuer's Ed25519 private key.

2. **Receipt integrity** — Any tampering with a receipt's fields invalidates the signature.

3. **Receipt freshness** — Receipts are timestamped and the Trust Authority rejects receipts outside the accepted age window (default: 24 hours future-dated: 5 minutes).

4. **Receipt non-replayability** — The `receipt_id` is deduplicated by the Trust Authority. A valid receipt cannot be submitted twice to double-boost a score.

5. **Token authenticity** — A trust token cannot be forged without the Trust Authority's Ed25519 private key.

6. **Token freshness** — Trust tokens expire (maximum 600 seconds). Stale behavioral history cannot substitute for current behavior.

7. **Domain isolation** — A trust token for domain A cannot be used to satisfy a verifier enforcing domain B.

8. **Stateless verifiability** — Verifiers can validate tokens without contacting the Trust Authority, eliminating dependency on TA availability at verification time.

9. **Single-issuer resistance** — The aggregation algorithm's issuer weight cap prevents any single issuer from dominating a trust score.

### 1.2 What TTP Does NOT Guarantee

1. **TTP does not detect deceptive behavior it cannot observe.** If an agent behaves well in observable contexts and behaves badly in unobserved contexts, TTP will report high trust. Coverage is a function of issuer deployment.

2. **TTP does not guarantee issuer accuracy.** A poorly calibrated issuer providing wrong scores will degrade aggregate score accuracy. Issuer quality is an operational concern.

3. **TTP does not prevent Trust Authority compromise.** A compromised Trust Authority can issue fraudulent tokens. Key management and access control for the Trust Authority are outside the protocol but critical operationally.

4. **TTP is not a substitute for runtime sandboxing.** TTP verifies trust; it does not confine agent capabilities. Use both.

---

## 2. Threat Model

### 2.1 Trust Hierarchy

```
Trust Authority private key       ← Root of all token trust
    └── Trust tokens              ← Trust issuance
Issuer private keys               ← Root of receipt trust
    └── Behavioral receipts       ← Raw evidence
Agent API keys                    ← Token request authentication
```

Compromise at a higher level in this hierarchy has broader impact.

### 2.2 Attacker Profiles

| Profile | Capability | Goal |
|---------|------------|------|
| **Compromised Agent** | Controls agent runtime | Obtain or forge high-trust tokens |
| **Malicious Issuer** | Controls one issuer | Inflate or suppress agent trust scores |
| **Compromised Trust Authority** | Controls TA key or service | Issue arbitrary trust tokens |
| **Network Attacker** | Man-in-the-middle on transport | Replay or intercept tokens |
| **Insider Threat** | Legitimate access to TA or issuers | Manipulate scores for specific agents |
| **AI Adversary** | Prompt injection / adversarial inputs | Cause agent to behave in ways that game behavioral scoring |

---

## 3. Threat Analysis

### T1: Token Replay Attack

**Description:** An attacker intercepts a valid trust token and reuses it after the legitimate agent has stopped using it, or uses it in a different context.

**Mitigations:**
- Short token TTL (≤300 seconds) limits the replay window.
- Transport-layer encryption (TLS) prevents interception in transit.
- The `jti` claim allows verifiers to cache seen token IDs and reject replays within the token's validity window.
- Domain scoping ensures a replayed token from domain A cannot be used against domain B.

**Residual risk:** Within the token's TTL, replay is possible if token interception occurs and the verifier does not implement `jti` replay detection.

**RECOMMENDED:** Verifiers handling high-stakes operations SHOULD implement `jti` replay detection. Store seen JTIs in a cache with TTL equal to the token's remaining validity.

---

### T2: Token Forgery

**Description:** An attacker forges a trust token claiming a high trust score for an untrusted agent.

**Mitigations:**
- Tokens are signed with the Trust Authority's Ed25519 key.
- Ed25519 is computationally infeasible to forge without the private key.
- Verifiers validate the signature before accepting any claims.

**Residual risk:** If the Trust Authority's private key is compromised, forgery becomes possible. See T6.

---

### T3: Receipt Forgery

**Description:** An attacker forges a behavioral receipt to fraudulently boost an agent's trust score.

**Mitigations:**
- Receipts are signed with the issuer's Ed25519 key.
- The Trust Authority verifies receipt signatures before accepting them.
- The issuer must be registered with the Trust Authority.

**Residual risk:** If an issuer's private key is compromised, the attacker can generate receipts up to the issuer weight cap (40%). Multi-issuer requirements for sensitive domains mitigate this.

---

### T4: Receipt Replay

**Description:** A valid receipt from a past event is resubmitted to the Trust Authority to re-boost a score.

**Mitigations:**
- The Trust Authority deduplicates receipts by `receipt_id`.
- A duplicate `receipt_id` results in a `202 Duplicate` response with no score effect.

**Residual risk:** If the Trust Authority loses its receipt deduplication state (e.g., after a restart), receipts within the age window could be resubmitted. Persistent deduplication storage (e.g., Redis with TTL) is RECOMMENDED.

---

### T5: Single-Issuer Score Domination

**Description:** An attacker controls or compromises a single high-volume issuer and uses it to inflate an agent's trust score.

**Mitigations:**
- The aggregation algorithm caps any single issuer's contribution at `max_issuer_weight` (default: 40%).
- Even if one issuer submits 1000 receipts, it cannot exceed 40% of the aggregate weight.
- Multi-issuer requirements (`min_issuer_count ≥ 2`) prevent single-issuer tokens entirely for sensitive domains.

**Residual risk:** If only one issuer is deployed, that issuer's compromise fully controls agent trust. Deploy at least 2 independent issuers per domain.

---

### T6: Trust Authority Key Compromise

**Description:** An attacker obtains the Trust Authority's Ed25519 private key, enabling them to issue arbitrary trust tokens for any agent.

**Impact:** Critical. All verifiers would accept fraudulent tokens.

**Mitigations:**
- Store the TA private key in a Hardware Security Module (HSM) or cloud KMS.
- Implement key rotation (see Section 4).
- Monitor token issuance for anomalies (unusual agents, unusual scores).
- Use short token TTLs to limit the window of exploitation before detection.
- Implement rate limiting on token issuance.

**Incident response:** If key compromise is suspected:
1. Rotate to a new keypair immediately.
2. Publish the new key at `/.well-known/ttp-keys`.
3. Notify verifiers to refresh their key cache.
4. Audit all tokens issued in the suspected compromise window.

---

### T7: Issuer Collusion

**Description:** Multiple issuers collude to consistently report fraudulent scores for specific agents.

**Mitigations:**
- Issuer independence is an operational requirement. Issuers SHOULD be operated by independent parties with independent business interests.
- The weight cap limits the impact even of colluding majority-weight issuers.
- Operators SHOULD monitor per-issuer score distributions to detect coordinated anomalies.
- The Trust Authority SHOULD flag cases where issuers consistently agree (especially on scores near 1.0) without variance.

**Residual risk:** If all issuers for a domain are controlled by a single party, that party can fully control trust scores. For high-stakes domains, require issuers operated by genuinely independent parties (e.g., different organizations).

---

### T8: Behavioral Gaming by Agent

**Description:** An agent behaves well in observable contexts to build trust, then exploits that trust in an unobserved context.

**Mitigations:**
- Short token TTL ensures trust reflects **recent** behavior, not a long track record.
- Multiple independent issuers observing different aspects of behavior make selective gaming harder.
- Domain scoping limits blast radius: high trust in one domain doesn't help in another.
- Negative signal amplification (1.5x weight) ensures that a few dangerous actions significantly impact the score.
- Runtime monitoring (issuers observing real-time behavior) reduces the window for gaming.

**Residual risk:** This is a fundamental limitation of behavioral trust systems. Perfect game-proofing requires complete coverage of all agent actions, which is not always achievable. TTP provides strong deterrence but cannot eliminate sophisticated gaming strategies.

---

### T9: Prompt Injection Targeting Issuers

**Description:** An adversary crafts inputs to an AI agent that, when the agent processes and acts on them, cause issuer-observable behavior that artificially inflates scores.

**Example:** An input that causes an agent to make many successful API calls (boosting API gateway issuer scores) while also causing harmful unobserved actions.

**Mitigations:**
- Deploy inference output monitors as issuers — they evaluate the actual content of agent outputs, not just API-level behavior.
- Safety monitor issuers specifically look for adversarial patterns.
- Multi-issuer requirements ensure that gaming one type of issuer doesn't suffice.

---

### T10: Trust Authority Availability Attack

**Description:** An attacker takes the Trust Authority offline, preventing agents from obtaining new tokens.

**Impact:** New token issuance fails. Agents with valid cached tokens can continue operating until tokens expire. After expiration, service disruption occurs (with `deny` fallback policy).

**Mitigations:**
- Deploy Trust Authority in high-availability configuration (multiple instances, load balancing).
- Verifiers with `cached` fallback policy continue accepting tokens past expiry for a bounded window.
- Agents cache tokens and only need TA availability at token refresh time, not at each service call.
- Implement monitoring and alerting on TA availability.

---

## 4. Key Management

### 4.1 Trust Authority Key Management

The Trust Authority signing key is the root of trust. It MUST be treated with commensurate care.

**Requirements:**
- Store in an HSM or cloud KMS (AWS KMS, GCP Cloud KMS, Azure Key Vault, HashiCorp Vault).
- Never write the private key to disk in plaintext.
- Restrict signing key access to the Trust Authority service only.
- Audit all signing operations.
- Rotate at minimum every 12 months, or immediately upon suspected compromise.

**Key rotation procedure:**
1. Generate new keypair in the HSM/KMS.
2. Add the new public key to `/.well-known/ttp-keys` alongside the existing key.
3. Update the Trust Authority to sign new tokens with the new key (new `kid`).
4. Wait for all tokens signed with the old key to expire (`max_ttl` seconds after rotation).
5. Remove the old public key from `/.well-known/ttp-keys`.

### 4.2 Issuer Key Management

**Requirements:**
- Generate a unique Ed25519 keypair per issuer instance.
- Store private keys using the platform's secret management (Kubernetes Secrets, Vault, cloud secret manager).
- Rotate issuer keys at minimum annually.
- Deregister and re-register issuers when rotating keys to maintain Trust Authority integrity.

### 4.3 Agent API Key Management

Agent API keys authenticate token requests to the Trust Authority.

**Requirements:**
- Generate a unique API key per agent.
- Treat agent API keys as secrets. Rotate on suspected compromise.
- Rate-limit token requests per API key at the Trust Authority.

---

## 5. Deployment Security Recommendations

### 5.1 Minimum Issuer Count

For any domain handling sensitive operations:

| Domain Sensitivity | Minimum Issuer Count | Minimum Score Threshold |
|-------------------|---------------------|------------------------|
| Low (logging, read-only) | 1 | 0.70 |
| Medium (data writes, notifications) | 2 | 0.80 |
| High (financial, production changes) | 3 | 0.90 |
| Critical (large transactions, infra changes) | 3+ | 0.95 |

### 5.2 Transport Security

All TTP communication MUST use TLS 1.2 or higher. TLS termination at the Trust Authority. Certificate pinning is RECOMMENDED for issuer-to-TA communication.

### 5.3 Trust Authority Network Segmentation

The Trust Authority SHOULD be network-isolated. Only issuers and agent clients should be able to reach the receipt submission and token issuance endpoints. Verifiers only need access to `/.well-known/ttp-keys`.

### 5.4 Monitoring

Operators SHOULD implement alerting for:

- Token issuance rate spikes (potential TA abuse)
- Score distribution anomalies per issuer (potential calibration drift or gaming)
- Receipt submission bursts from a single issuer (potential replay attack)
- Token rejections at verifiers (potential compromised agents)
- Trust Authority latency spikes (potential availability attack)

---

## 6. Security Audit Scope

When engaging security auditors to review a TTP deployment:

**Cryptographic review:**
- Ed25519 signing and verification implementation
- JWT construction and parsing
- Receipt canonicalization (must match spec exactly)
- Key storage and access control

**Protocol review:**
- Receipt deduplication state persistence
- Token TTL enforcement
- Domain scope enforcement
- Clock skew handling

**Aggregation review:**
- Correctness of the weight cap algorithm
- Resistance to score inflation through high receipt volume
- Negative signal amplification correctness

**Operational review:**
- Trust Authority key storage
- Issuer independence
- Monitoring and alerting coverage
- Incident response procedures

---

## 7. Responsible Disclosure

Security vulnerabilities in the TTP specification, reference implementations, or SDKs should be reported privately to:

**Email:** maurice@blocksifr.com  
**PGP:** Available on request

Please include:
- Affected component and version
- Description of the vulnerability
- Proof of concept or reproduction steps
- Potential impact

We will acknowledge within 48 hours and coordinate disclosure.
