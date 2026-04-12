/**
 * TTP Trust Score Aggregation Algorithm
 *
 * Implements the normative algorithm from protocol/aggregation-spec.md.
 * Given the same inputs, this function MUST produce the same output as any
 * other conformant implementation (within ±0.001 tolerance).
 */

import { StoredReceipt, AggregationResult } from "./types"

export interface AggregationParams {
  receiptWindowS?: number          // default: 300
  maxIssuerWeight?: number         // default: 0.40
  negativeWeightMultiplier?: number // default: 1.5
  decayHalfLifeS?: number          // default: 120
}

export function aggregateTrustScore(
  receipts: StoredReceipt[],
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
    throw new Error("INSUFFICIENT_TRUST_DATA")
  }

  // Step 2 & 3: Compute time-decay weights and apply negative signal amplification
  const weighted = windowReceipts.map(r => {
    const ageS = (currentTimeMs - r.timestamp) / 1000
    const decayWeight = Math.exp(-Math.LN2 * ageS / decayHalfLifeS)
    // Negative signal (score < 0.5) gets amplified weight
    const signalWeight = r.score < 0.5
      ? decayWeight * negativeWeightMultiplier
      : decayWeight
    return { ...r, signalWeight }
  })

  // Step 4: Compute per-issuer weighted scores
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

  // Step 5: Cap per-issuer weights to prevent single-issuer domination
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

  // Step 6: Compute final score
  const rawScore = normalized.reduce((sum, i) => sum + i.score * i.normalizedWeight, 0)

  // Clamp to [0.0, 1.0] to handle floating-point edge cases
  const score = Math.max(0.0, Math.min(1.0, rawScore))

  // Metadata
  const oldestTimestamp = Math.min(...windowReceipts.map(r => r.timestamp))
  const oldestReceiptAgeS = Math.floor((currentTimeMs - oldestTimestamp) / 1000)

  return {
    score,
    contributingReceipts: windowReceipts.length,
    contributingIssuers: issuers.length,
    oldestReceiptAgeS
  }
}
