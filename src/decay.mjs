const RISK_MULTIPLIER = {
  low: 1,
  medium: 0.92,
  high: 0.82,
  critical: 0.65,
};

export function apply_decay({
  initialTrust,
  decayConstant,
  elapsedSeconds,
  activitySignals = [],
  riskTier = 'low',
  calculatedAt = new Date().toISOString(),
} = {}) {
  const baseTrust = clamp01(Number(initialTrust ?? 0));
  const lambda = Math.max(0, Number(decayConstant ?? 0));
  const elapsed = Math.max(0, Number(elapsedSeconds ?? 0));
  const multiplier = RISK_MULTIPLIER[riskTier] ?? RISK_MULTIPLIER.low;
  const decayedTrust = baseTrust * Math.exp(-lambda * elapsed) * multiplier;
  const signalBoost = activitySignals.reduce((sum, signal) => {
    if (signal?.verified === false) return sum;
    const weight = clamp01(Number(signal?.weight ?? 0));
    const recencyFactor = clamp01(Number(signal?.recencyFactor ?? signal?.rating ?? 0));
    return sum + weight * recencyFactor;
  }, 0);
  const finalTrust = clamp01(decayedTrust + signalBoost);

  return {
    initialTrust: baseTrust,
    decayedTrust,
    signalBoost,
    finalTrust,
    riskTier,
    calculatedAt,
  };
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
