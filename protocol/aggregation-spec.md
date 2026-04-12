# TTP Trust Score Aggregation Algorithm — v1.0

**Status:** Normative  
**Part of:** Trust Transfer Protocol Specification v1.0

---

## Overview

This document defines the normative algorithm by which a Trust Authority computes a trust score from a set of behavioral receipts. All conformant Trust Authorities MUST implement this algorithm or a documented equivalent that produces identical outputs for the test vectors in [test-vectors/](test-vectors/).

The algorithm is deterministic: given the same set of receipts and the same current time, it MUST produce the same score.

---

## 1. Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `receipts` | Receipt[] | All valid, deduplicated receipts for the agent within the receipt window |
| `current_time_ms` | integer | Current Unix timestamp in milliseconds |
| `receipt_window_s` | integer | Seconds of history to consider (default: 300) |
| `max_issuer_weight` | float | Maximum fraction any single issuer may contribute (default: 0.40) |
| `negative_weight_multiplier` | float | Extra weight applied to negative signals (default: 1.5) |
| `decay_half_life_s` | integer | Half-life for exponential time decay in seconds (default: 120) |

## 2. Outputs

| Value | Type | Description |
|-------|------|-------------|
| `score` | float [0.0, 1.0] | Aggregated trust score |
| `contributing_receipts` | integer | Number of receipts used |
| `contributing_issuers` | integer | Number of distinct issuers |
| `oldest_receipt_age_s` | integer | Age in seconds of the oldest contributing receipt |

---

## 3. Algorithm

### Step 1 — Filter to Receipt Window

Discard all receipts where:

```
current_time_ms - receipt.timestamp > receipt_window_s * 1000
```

The remaining set is `window_receipts`.

If `window_receipts` is empty, return `INSUFFICIENT_TRUST_DATA`.

### Step 2 — Compute Time-Decay Weights

For each receipt `r` in `window_receipts`, compute its age weight:

```
age_s(r) = (current_time_ms - r.timestamp) / 1000

decay_weight(r) = exp(-ln(2) * age_s(r) / decay_half_life_s)
```

This is standard exponential decay. A receipt at age 0 has weight 1.0. A receipt at age `decay_half_life_s` has weight 0.5.

### Step 3 — Apply Negative Signal Amplification

For each receipt `r`, compute the signal-adjusted score contribution:

```
if r.score < 0.5:
    adjusted_score(r) = r.score                           # negative signal
    signal_weight(r) = decay_weight(r) * negative_weight_multiplier
else:
    adjusted_score(r) = r.score                           # positive signal
    signal_weight(r) = decay_weight(r)
```

Rationale: An agent gaming the system by behaving well most of the time should not be able to offset a few dangerous actions. Negative signal receives higher weight to ensure safety-critical behavior dominates.

### Step 4 — Per-Issuer Score Computation

Group receipts by `issuer_id`. For each issuer `i`, compute a weighted score:

```
issuer_weighted_sum(i) = sum(adjusted_score(r) * signal_weight(r) for r in receipts[i])
issuer_total_weight(i) = sum(signal_weight(r) for r in receipts[i])

issuer_score(i) = issuer_weighted_sum(i) / issuer_total_weight(i)
issuer_raw_weight(i) = issuer_total_weight(i)
```

### Step 5 — Issuer Weight Capping

To prevent any single issuer from dominating the aggregate score, cap each issuer's contribution:

```
total_raw_weight = sum(issuer_raw_weight(i) for all issuers i)

for each issuer i:
    uncapped_fraction(i) = issuer_raw_weight(i) / total_raw_weight
    capped_fraction(i) = min(uncapped_fraction(i), max_issuer_weight)

# Re-normalize capped fractions to sum to 1.0
normalization_factor = sum(capped_fraction(i) for all issuers i)

for each issuer i:
    normalized_weight(i) = capped_fraction(i) / normalization_factor
```

### Step 6 — Final Score

```
raw_score = sum(issuer_score(i) * normalized_weight(i) for all issuers i)

# Clamp to [0.0, 1.0] to handle floating point edge cases
score = max(0.0, min(1.0, raw_score))
```

---

## 4. Reference Implementation (TypeScript)

```typescript
interface Receipt {
  receipt_id: string
  agent_id: string
  issuer_id: string
  timestamp: number // milliseconds
  score: number    // [0.0, 1.0]
  domain: string
}

interface AggregationParams {
  receiptWindowS?: number         // default: 300
  maxIssuerWeight?: number        // default: 0.40
  negativeWeightMultiplier?: number // default: 1.5
  decayHalfLifeS?: number         // default: 120
}

interface AggregationResult {
  score: number
  contributingReceipts: number
  contributingIssuers: number
  oldestReceiptAgeS: number
}

export function aggregateTrustScore(
  receipts: Receipt[],
  currentTimeMs: number,
  params: AggregationParams = {}
): AggregationResult {
  const {
    receiptWindowS = 300,
    maxIssuerWeight = 0.40,
    negativeWeightMultiplier = 1.5,
    decayHalfLifeS = 120
  } = params

  // Step 1: Filter to receipt window
  const windowMs = receiptWindowS * 1000
  const windowReceipts = receipts.filter(
    r => (currentTimeMs - r.timestamp) <= windowMs
  )

  if (windowReceipts.length === 0) {
    throw new Error('INSUFFICIENT_TRUST_DATA')
  }

  // Step 2 & 3: Compute decay weights and apply negative amplification
  const weighted = windowReceipts.map(r => {
    const ageS = (currentTimeMs - r.timestamp) / 1000
    const decayWeight = Math.exp(-Math.LN2 * ageS / decayHalfLifeS)
    const signalWeight = r.score < 0.5
      ? decayWeight * negativeWeightMultiplier
      : decayWeight
    return { ...r, signalWeight }
  })

  // Step 4: Per-issuer weighted scores
  const issuerMap = new Map<string, { weightedSum: number; totalWeight: number }>()

  for (const r of weighted) {
    const entry = issuerMap.get(r.issuer_id) ?? { weightedSum: 0, totalWeight: 0 }
    entry.weightedSum += r.score * r.signalWeight
    entry.totalWeight += r.signalWeight
    issuerMap.set(r.issuer_id, entry)
  }

  const issuers = Array.from(issuerMap.entries()).map(([id, { weightedSum, totalWeight }]) => ({
    id,
    score: weightedSum / totalWeight,
    rawWeight: totalWeight
  }))

  // Step 5: Cap issuer weights
  const totalRawWeight = issuers.reduce((sum, i) => sum + i.rawWeight, 0)

  const capped = issuers.map(i => ({
    ...i,
    cappedFraction: Math.min(i.rawWeight / totalRawWeight, maxIssuerWeight)
  }))

  const normalizationFactor = capped.reduce((sum, i) => sum + i.cappedFraction, 0)

  const normalized = capped.map(i => ({
    ...i,
    normalizedWeight: i.cappedFraction / normalizationFactor
  }))

  // Step 6: Final score
  const rawScore = normalized.reduce((sum, i) => sum + i.score * i.normalizedWeight, 0)
  const score = Math.max(0.0, Math.min(1.0, rawScore))

  // Compute metadata
  const oldestTimestamp = Math.min(...windowReceipts.map(r => r.timestamp))
  const oldestReceiptAgeS = Math.floor((currentTimeMs - oldestTimestamp) / 1000)

  return {
    score,
    contributingReceipts: windowReceipts.length,
    contributingIssuers: issuers.length,
    oldestReceiptAgeS
  }
}
```

---

## 5. Test Cases

These cases MUST produce the indicated scores (±0.001 tolerance).

### Case 1: Single issuer, single perfect receipt

```
receipts = [{ issuer: "A", score: 1.0, age: 0s }]
expected_score = 1.0
```

### Case 2: Single issuer, single zero receipt

```
receipts = [{ issuer: "A", score: 0.0, age: 0s }]
expected_score = 0.0
```

### Case 3: Two issuers, equal weight, divergent scores

```
receipts = [
  { issuer: "A", score: 1.0, age: 0s },
  { issuer: "B", score: 0.0, age: 0s }
]
# B's negative score gets multiplier 1.5
# issuer_score(A) = 1.0, issuer_score(B) = 0.0
# issuer_raw_weight(A) = exp(0) = 1.0
# issuer_raw_weight(B) = exp(0) * 1.5 = 1.5
# total_raw_weight = 2.5
# uncapped_fraction(A) = 0.4, uncapped_fraction(B) = 0.6
# Both under max_issuer_weight cap (0.40 for A, B=0.60 → capped to 0.40)
# normalized: A=0.5, B=0.5
# score = 1.0*0.5 + 0.0*0.5 = 0.5
expected_score ≈ 0.5
```

### Case 4: Decay — older receipt has less influence

```
receipts = [
  { issuer: "A", score: 1.0, age: 0s },
  { issuer: "A", score: 0.0, age: 120s }  # half-life decay
]
# decay_weight(recent) = 1.0, decay_weight(old) = 0.5 * negative_multiplier(1.5) = 0.75
# issuer_score(A) = (1.0*1.0 + 0.0*0.75) / (1.0 + 0.75) = 1.0/1.75 ≈ 0.571
expected_score ≈ 0.571
```

### Case 5: Issuer cap prevents domination

```
receipts = [
  { issuer: "A", score: 1.0, age: 0s },
  { issuer: "A", score: 1.0, age: 10s },
  { issuer: "A", score: 1.0, age: 20s },
  { issuer: "B", score: 0.0, age: 0s }   # single negative receipt from B
]
# With max_issuer_weight=0.40: issuer B (negative, amplified) gets substantial weight
# The cap prevents A from overwhelming B's negative signal
# expected: score < 0.9 (B's single bad receipt has real influence)
```

Full machine-readable test vectors with exact inputs and expected outputs are in [test-vectors/aggregation-vectors.json](test-vectors/aggregation-vectors.json).

---

## 6. Rationale for Design Choices

### Why exponential decay?

Exponential decay is the standard model for "memory" in trust systems. It ensures:
- Recent behavior matters more than old behavior
- There is no sharp cliff (a receipt doesn't suddenly become worthless at T+N)
- The math is simple, fast, and reproducible

### Why negative signal amplification?

If an agent can earn trust by behaving well 90% of the time and offset one dangerous action through accumulated good behavior, the system fails at its safety goal. The 1.5x multiplier on negative signals (score < 0.5) tilts the balance toward safety. Operators MAY configure a higher multiplier for high-stakes domains.

### Why issuer weight capping?

Without a cap, a single issuer generating many receipts could dominate the aggregate score. This creates an attack surface: compromise one high-volume issuer and control agent trust scores. The 40% cap ensures that even the highest-volume issuer cannot singlehandedly determine trust.

### Why deterministic?

Two Trust Authorities given the same receipts should produce the same score. This is required for:
- Federated deployments
- Auditability (reproduce the score that led to an access decision)
- Testing and conformance verification
