import { apply_decay } from './ttp.mjs';
import { severityRank } from './consequences.mjs';

// Trust is not permanent. Evidence ages, and aged evidence buys less authority.
export const TRUST_REQUIRED = { CRITICAL: 0.90, HIGH: 0.75, MEDIUM: 0.60, LOW: 0.0 };
export const MAX_EVIDENCE_AGE_SECONDS = { CRITICAL: 300, HIGH: 900, MEDIUM: 3600, LOW: Infinity };

const RISK_TIER = { CRITICAL: 'high', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

export function agentTrustNow(agent, { severity = 'MEDIUM', decayConstant = 0.00005, at = new Date().toISOString(), measured = null } = {}) {
  // Measured trust beats declared trust, and unproven beats neither: an agent whose
  // trust was never measured does not get to keep the number in the manifest.
  if (measured) {
    if (!measured.proven) {
      return {
        agentId: agent.id, trust: 0, declaredTrust: agent.trust ?? 0, provenance: 'unproven',
        evidenceAgeSeconds: Infinity, evidenceStale: true,
        maxEvidenceAgeSeconds: MAX_EVIDENCE_AGE_SECONDS[severity],
        reason: 'no admissible evidence: trust was never measured for this agent'
      };
    }
    const age = measured.oldestEvidenceAgeSeconds ?? 0;
    const maxAge = MAX_EVIDENCE_AGE_SECONDS[severity];
    return {
      agentId: agent.id, trust: measured.trust, declaredTrust: agent.trust ?? null,
      provenance: 'measured', evidenceAgeSeconds: age, evidenceStale: age > maxAge,
      maxEvidenceAgeSeconds: maxAge, contributingIssuers: measured.contributingIssuers
    };
  }
  return declaredTrustNow(agent, { severity, decayConstant, at });
}

function declaredTrustNow(agent, { severity = 'MEDIUM', decayConstant = 0.00005, at = new Date().toISOString() } = {}) {
  const decayed = apply_decay({
    initialTrust: agent.trust ?? 0,
    decayConstant,
    elapsedSeconds: agent.evidenceAgeSeconds ?? 0,
    activitySignals: agent.activitySignals ?? [],
    riskTier: RISK_TIER[severity] ?? 'low',
    calculatedAt: at
  });
  const maxAge = MAX_EVIDENCE_AGE_SECONDS[severity];
  return {
    agentId: agent.id,
    trust: Number(decayed.finalTrust.toFixed(4)),
    declaredTrust: agent.trust ?? 0,
    provenance: 'declared',
    evidenceAgeSeconds: agent.evidenceAgeSeconds ?? 0,
    evidenceStale: (agent.evidenceAgeSeconds ?? 0) > maxAge,
    maxEvidenceAgeSeconds: maxAge
  };
}

export const meetsThreshold = (trust, severity) => trust >= (TRUST_REQUIRED[severity] ?? 0);

// A trust input changed materially enough to force route reevaluation.
export function trustChanged(before, after) {
  return before.trust !== after.trust || before.evidenceStale !== after.evidenceStale;
}

export const requiresHumanApproval = (severity, policy = {}) =>
  policy.requireApprovalAtOrAbove
    ? severityRank(severity) >= severityRank(policy.requireApprovalAtOrAbove)
    : severity === 'CRITICAL';
