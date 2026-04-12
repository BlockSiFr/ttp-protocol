# TTP Behavioral Scoring Semantics — v1.0

**Status:** Normative  
**Part of:** Trust Transfer Protocol Specification v1.0

---

## Overview

A behavioral receipt contains a `score` field: a float in [0.0, 1.0] representing the issuer's assessment of the agent's behavior during the observed event. This document defines what scores mean, how issuers should compute them, and how different event types map to the scoring scale.

Without a shared scoring semantics, multi-issuer aggregation is meaningless — a 0.9 from an API gateway could mean something entirely different from a 0.9 from a security monitor.

---

## 1. The Score Scale

| Range | Label | Meaning |
|-------|-------|---------|
| 0.90 – 1.00 | Excellent | Behavior was fully expected, safe, and aligned with policy |
| 0.70 – 0.89 | Good | Behavior was acceptable with minor deviations or risk signals |
| 0.50 – 0.69 | Marginal | Behavior was borderline; elevated risk but not a clear violation |
| 0.30 – 0.49 | Poor | Behavior showed concerning patterns or mild policy violations |
| 0.10 – 0.29 | Bad | Behavior was clearly unsafe, violated policies, or triggered alerts |
| 0.00 – 0.09 | Critical | Behavior was a serious violation requiring immediate response |

**Anchoring principle:** Scores should be calibrated against a baseline population of expected agent behavior for the issuer's domain. An agent doing exactly what it should do receives ≥0.90. Scores below 0.50 should be reserved for genuinely concerning behavior — not minor anomalies.

---

## 2. Score Independence

Each receipt's score MUST represent the issuer's independent assessment of the observed behavior. Issuers MUST NOT attempt to factor in other issuers' assessments, the agent's historical score, or the current token score when computing a receipt score.

The Trust Authority aggregates independent signals. If issuers correlate their scores with each other, the independence assumption breaks down and the aggregation provides weaker security guarantees.

---

## 3. Event Types and Scoring Guidance

### 3.1 `api_call`

Issued by API gateways, proxies, or service meshes observing API requests from the agent.

| Situation | Score Range |
|-----------|-------------|
| Request succeeded, normal parameters, expected endpoint | 0.90 – 1.00 |
| Request succeeded, unusual parameters (but within policy) | 0.70 – 0.89 |
| Request failed with client error (4xx) — unexpected | 0.50 – 0.69 |
| Request to unauthorized endpoint (blocked) | 0.20 – 0.49 |
| Repeated unauthorized access attempts | 0.00 – 0.19 |
| Abnormally high request rate (approaching rate limit) | 0.50 – 0.69 |
| Rate limit exceeded | 0.20 – 0.49 |

### 3.2 `tool_execution`

Issued by tool execution environments (function calling sandboxes, RPA runtimes, etc.).

| Situation | Score Range |
|-----------|-------------|
| Tool called with expected parameters, completed successfully | 0.90 – 1.00 |
| Tool completed but with unexpected side effects (logged) | 0.60 – 0.79 |
| Tool call failed — recoverable error | 0.60 – 0.75 |
| Tool call failed — policy violation detected | 0.10 – 0.39 |
| Tool called with parameters outside allowed bounds | 0.20 – 0.49 |
| Attempted to call a disallowed tool | 0.00 – 0.29 |

### 3.3 `inference_output`

Issued by inference monitoring layers that evaluate model outputs for safety properties.

| Situation | Score Range |
|-----------|-------------|
| Output passed all safety checks | 0.90 – 1.00 |
| Output contained borderline content (minor flags) | 0.60 – 0.79 |
| Output contained moderate safety flags | 0.30 – 0.59 |
| Output contained serious safety violations | 0.00 – 0.29 |
| Output classified as jailbreak attempt | 0.00 – 0.09 |
| Output contained PII that should not be present | 0.00 – 0.29 |
| Output showed prompt injection patterns | 0.00 – 0.19 |

### 3.4 `data_access`

Issued by data systems (databases, file stores, knowledge bases) tracking agent data interactions.

| Situation | Score Range |
|-----------|-------------|
| Read access to authorized data, normal volume | 0.90 – 1.00 |
| Read access to authorized data, unusual volume | 0.50 – 0.79 |
| Attempted access to unauthorized data (blocked) | 0.10 – 0.39 |
| Write access to authorized data | 0.85 – 1.00 |
| Write access creating unexpected side effects | 0.40 – 0.69 |
| Bulk export beyond normal parameters | 0.20 – 0.49 |

### 3.5 `financial_transaction`

Issued by financial services systems observing agent-initiated transactions.

| Situation | Score Range |
|-----------|-------------|
| Transaction within approved parameters, succeeded | 0.90 – 1.00 |
| Transaction within parameters, slightly unusual recipient/amount | 0.70 – 0.89 |
| Transaction near parameter limits | 0.50 – 0.69 |
| Transaction outside approved parameters (blocked) | 0.00 – 0.29 |
| Repeated failed transaction attempts | 0.10 – 0.39 |
| Transaction to flagged counterparty | 0.00 – 0.19 |

### 3.6 `safety_monitor`

Issued by dedicated AI safety monitoring systems.

| Situation | Score Range |
|-----------|-------------|
| All safety invariants passed | 1.00 |
| Minor anomaly detected, within bounds | 0.70 – 0.89 |
| Behavioral drift detected | 0.40 – 0.69 |
| Alignment violation detected | 0.00 – 0.29 |
| Adversarial input pattern detected | 0.00 – 0.19 |

### 3.7 Custom Event Types

Issuers MAY define custom event types using reverse-domain notation: `com.example.custom_event`.

Custom event types MUST be documented by the issuer and SHOULD be accompanied by scoring guidance that maps to the standard scale above.

---

## 4. Score Computation Guidance for Issuer Implementers

### 4.1 Use a Policy-Based Approach

Rather than ad-hoc scoring, define a policy table mapping observable conditions to score ranges, then compute the score deterministically from observed conditions:

```typescript
function scoreApiCall(event: ApiCallEvent): number {
  if (event.statusCode >= 500) return 0.70  // server error, partial credit
  if (event.statusCode === 429) return 0.35  // rate limited
  if (event.statusCode === 403) return 0.20  // auth failure
  if (event.statusCode === 401) return 0.15  // unauth attempt
  if (event.latencyMs > event.p99LatencyMs * 3) return 0.75  // unusually slow
  if (!event.isExpectedEndpoint) return 0.60  // unexpected path
  return 1.0  // normal
}
```

### 4.2 Avoid Gradual Inflation

Do not continuously award 1.0 for every successful request. This inflates scores and removes sensitivity to rare bad behavior. Consider:

- Returning 0.95 for a normal successful call
- Returning 1.0 only for calls that demonstrate positive safety signals
- Returning 0.85 for calls that are successful but show minor anomalies

### 4.3 Be Consistent Across Agents

An issuer MUST use the same scoring logic for all agents. Agent-specific scoring rules compromise the independence of the issuer and the integrity of the aggregate.

### 4.4 Document Your Scoring Model

Operators deploying custom issuers SHOULD document the scoring model. Trust Authority operators can then configure appropriate weights if needed.

---

## 5. The `event_data` Field

The `event_data` object provides context for the score. It MUST NOT contain:

- Personally identifiable information (PII) of end users
- Authentication credentials
- Content of user messages or prompts

`event_data` SHOULD contain:

- Observable facts about the event (HTTP method, endpoint path, latency, status code)
- Risk signals that explain the score (flags triggered, anomaly type)
- Metadata useful for auditing (request ID, session ID without PII)

Example:

```json
"event_data": {
  "method": "POST",
  "path": "/api/issue-discount",
  "status_code": 200,
  "latency_ms": 43,
  "request_id": "req_9f3a7b2c",
  "flags": [],
  "anomaly_score": 0.02
}
```

---

## 6. Cross-Issuer Score Comparability

Scores from different issuers are combined by the aggregation algorithm. For the aggregate score to be meaningful, issuers MUST use the scale defined in Section 1 consistently.

When onboarding a new issuer, Trust Authority operators SHOULD:

1. Run the issuer in observation-only mode and review score distributions.
2. Verify the issuer's score distribution is calibrated (not always 1.0, not always 0.5).
3. Compare scores for the same events across multiple issuers to identify calibration drift.

A well-calibrated issuer producing scores for a healthy agent fleet should have a score distribution concentrated around 0.85–0.95 with a visible tail below 0.50 for problematic events.
