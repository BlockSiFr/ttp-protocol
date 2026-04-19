export function computeTrustScoreWithDecay({ baseScore, decayConstant, elapsedSeconds, weightedSignals = [] }) {
  const decayed = baseScore * Math.exp(-decayConstant * elapsedSeconds)
  const signalBoost = weightedSignals.reduce((sum, s) => sum + (s.weight * s.value), 0)
  const score = Math.max(0, Math.min(1, decayed + signalBoost))
  return score
}

export function trustZone(score) {
  if (score >= 0.85) return 'active'
  if (score >= 0.65) return 'degraded'
  if (score >= 0.4) return 'warning'
  return 'critical'
}
