// TTP TRUST SCORE AGGREGATION — the normative algorithm.
//
// Implements protocol/aggregation-spec.md v1.0 step for step. That document is marked
// normative and carries test vectors; tests/aggregation.test.mjs runs every one of them,
// so this file is not free to drift from the spec.
//
// The two properties that matter, both deliberate:
//   - Negative signals weigh more (default 1.5x). An agent behaving well most of the time
//     must not be able to average away a few dangerous actions.
//   - No single issuer may contribute more than a fraction of the score (default 0.40),
//     so one chatty or captured issuer cannot decide an agent's trust alone.

export const DEFAULT_PARAMS = {
  receipt_window_s: 300,
  max_issuer_weight: 0.40,
  negative_weight_multiplier: 1.5,
  decay_half_life_s: 120
};

export const INSUFFICIENT_TRUST_DATA = 'INSUFFICIENT_TRUST_DATA';

/**
 * @param receipts  [{ receipt_id, issuer_id, score, timestamp }] — valid, deduplicated
 * @param current_time_ms  evaluation time
 * @returns { score, contributing_receipts, contributing_issuers, oldest_receipt_age_s }
 *          or { error: 'INSUFFICIENT_TRUST_DATA' } when nothing is in the window.
 */
export function aggregateTrust(receipts = [], current_time_ms = Date.now(), params = {}) {
  const { receipt_window_s, max_issuer_weight, negative_weight_multiplier, decay_half_life_s } =
    { ...DEFAULT_PARAMS, ...params };

  // Step 1 — filter to the receipt window.
  const windowReceipts = receipts.filter(
    (r) => current_time_ms - r.timestamp <= receipt_window_s * 1000
  );
  if (!windowReceipts.length) {
    return { error: INSUFFICIENT_TRUST_DATA, score: null, contributing_receipts: 0, contributing_issuers: 0 };
  }

  // Steps 2 and 3 — time decay, then negative signal amplification.
  const weighted = windowReceipts.map((r) => {
    const age_s = (current_time_ms - r.timestamp) / 1000;
    const decay_weight = Math.exp((-Math.LN2 * age_s) / decay_half_life_s);
    const negative = r.score < 0.5;
    return {
      ...r, age_s,
      adjusted_score: r.score,
      signal_weight: negative ? decay_weight * negative_weight_multiplier : decay_weight
    };
  });

  // Step 4 — per-issuer weighted score.
  const byIssuer = new Map();
  for (const r of weighted) {
    const entry = byIssuer.get(r.issuer_id) ?? { weightedSum: 0, totalWeight: 0 };
    entry.weightedSum += r.adjusted_score * r.signal_weight;
    entry.totalWeight += r.signal_weight;
    byIssuer.set(r.issuer_id, entry);
  }
  const issuers = [...byIssuer].map(([issuer_id, e]) => ({
    issuer_id,
    issuer_score: e.weightedSum / e.totalWeight,
    issuer_raw_weight: e.totalWeight
  }));

  // Step 5 — cap each issuer's fraction, then re-normalize.
  const totalRawWeight = issuers.reduce((sum, i) => sum + i.issuer_raw_weight, 0);
  const capped = issuers.map((i) => ({
    ...i,
    capped_fraction: Math.min(i.issuer_raw_weight / totalRawWeight, max_issuer_weight)
  }));
  const normalizationFactor = capped.reduce((sum, i) => sum + i.capped_fraction, 0);

  // Step 6 — combine, and clamp for floating point.
  const rawScore = capped.reduce(
    (sum, i) => sum + i.issuer_score * (i.capped_fraction / normalizationFactor), 0
  );

  return {
    score: Math.max(0, Math.min(1, rawScore)),
    contributing_receipts: windowReceipts.length,
    contributing_issuers: issuers.length,
    oldest_receipt_age_s: Math.round(Math.max(...weighted.map((r) => r.age_s))),
    issuers: capped.map((i) => ({
      issuer_id: i.issuer_id,
      issuer_score: Number(i.issuer_score.toFixed(6)),
      weight: Number((i.capped_fraction / normalizationFactor).toFixed(6)),
      capped: i.issuer_raw_weight / totalRawWeight > max_issuer_weight
    }))
  };
}

// The scoring scale from protocol/scoring-semantics.md, so a score can be read in words.
export function scoreLabel(score) {
  if (score == null) return 'Unknown';
  if (score >= 0.90) return 'Excellent';
  if (score >= 0.70) return 'Good';
  if (score >= 0.50) return 'Marginal';
  if (score >= 0.30) return 'Poor';
  if (score >= 0.10) return 'Bad';
  return 'Critical';
}
