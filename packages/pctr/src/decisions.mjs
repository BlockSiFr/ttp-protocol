import { severityRank } from './consequences.mjs';

// TRUST CHANGE -> ROUTE REEVALUATION -> RESPONSE.
//
// A trust change is not a binary. Denying everything that wobbles is as wrong as
// allowing it: the useful answer is usually narrower than "no" — reroute around the
// agent that went stale, cap the batch, ask a human, slow it down. These are the nine
// responses a reevaluation can produce, ordered from least to most restrictive.
export const RESPONSES = [
  'KEEP',      // nothing material changed; the route stands
  'REROUTE',   // another admissible route exists
  'CONSTRAIN', // admissible once the parameters are bounded
  'STEP_UP',   // same principal, stronger evidence required
  'ESCALATE',  // a higher authority or a human must decide
  'THROTTLE',  // permitted, but not at this rate
  'SUSPEND',   // this agent stops until something is repaired
  'DENY',      // this execution does not happen
  'REVOKE'     // the authority itself is withdrawn
];

const RESTRICTIVENESS = Object.fromEntries(RESPONSES.map((r, i) => [r, i]));
export const isMoreRestrictive = (a, b) => RESTRICTIVENESS[a] > RESTRICTIVENESS[b];

// Whether an execution may still proceed under this response, and on what terms.
export const PROCEEDS = {
  KEEP: true, REROUTE: true, CONSTRAIN: true, THROTTLE: true,
  STEP_UP: false, ESCALATE: false, SUSPEND: false, DENY: false, REVOKE: false
};

// TTP grades chain trust rather than returning a boolean, and each grade implies a
// downstream posture (SPECIFICATION.md, Trust Classification). This is the mapping a
// RuntimeAuthority applies to turn a classification into one of the responses above.
// TRUST_UNKNOWN is not neutral: a chain nobody evaluated is not a trustworthy chain.
export const CLASSIFICATION_POSTURE = {
  TRUST_ACCEPTED: ['KEEP', 'REROUTE'],
  TRUST_ACCEPTED_WITH_CONTROLS: ['CONSTRAIN', 'THROTTLE'],
  TRUST_REVIEW_RECOMMENDED: ['STEP_UP'],
  TRUST_CONTRADICTED: ['ESCALATE'],
  TRUST_DEFECTIVE: ['ESCALATE', 'DENY'],
  TRUST_REJECTED: ['DENY'],
  TRUST_UNKNOWN: ['DENY', 'ESCALATE']
};

export const CHAIN_CONTINUITY = [
  'CHAIN_CONTINUOUS', 'CHAIN_MISSING_LINK', 'CHAIN_MULTI_MISSING_LINK',
  'CHAIN_SUSPENDED', 'CHAIN_AMBIGUOUS', 'CHAIN_INFERRED', 'CHAIN_UNKNOWN'
];

export const LATENT_DEFECTS = [
  'prompt_injection_suspected', 'approval_bypass', 'stale_authority', 'unowned_identity',
  'unexpected_tool_use', 'context_loss', 'policy_version_mismatch', 'scope_inflation',
  'dependency_substitution', 'token_origin_unclear', 'chain_link_unproven'
];

/** The response a classification permits, narrowed by what the situation allows. */
export function postureFor(classification) {
  const allowed = CLASSIFICATION_POSTURE[classification] ?? CLASSIFICATION_POSTURE.TRUST_UNKNOWN;
  return { classification, allowed, proceeds: allowed.some((r) => PROCEEDS[r]) };
}

/**
 * A response must sit inside the posture its classification permits. Answering
 * TRUST_REJECTED with a reroute is how a graded protocol degrades into a boolean one
 * that always says yes.
 */
export function withinPosture(response, classification) {
  return (CLASSIFICATION_POSTURE[classification] ?? CLASSIFICATION_POSTURE.TRUST_UNKNOWN).includes(response);
}

/**
 * Decide how to respond when a route is reevaluated. Checks run most-restrictive first,
 * so a revoked credential is never answered with a reroute.
 */
export function respondToChange({
  action, preview, previousRoute = null, currentRoute = null,
  agents = [], policy = {}, history = {}, at = new Date().toISOString()
} = {}) {
  const severity = preview?.severity ?? 'LOW';
  const decide = (response, reason, detail = {}) => ({
    response, reason, action, severity, at, proceeds: PROCEEDS[response], detail
  });

  // REVOKE — the authority itself is gone. Nothing downstream can repair this.
  const revoked = agents.find((a) => a.revoked || a.credentialRevoked);
  if (revoked) {
    return decide('REVOKE', `${revoked.id}'s credential has been revoked, so any authority derived from it is withdrawn`,
      { agent: revoked.id });
  }

  // SUSPEND — the agent is quarantined, killed, or has failed repeatedly enough that
  // continuing to ask is itself the problem.
  const suspended = agents.find((a) => a.quarantined || a.killed || a.trust === 0);
  if (suspended) {
    return decide('SUSPEND', `${suspended.id} is quarantined or has no trust left; it stops until that is repaired`,
      { agent: suspended.id });
  }
  const failureLimit = policy.suspendAfterFailures ?? 5;
  const failures = history.consecutiveFailures ?? 0;
  if (failures >= failureLimit) {
    return decide('SUSPEND', `${failures} consecutive failures on ${action} reached the limit of ${failureLimit}`,
      { consecutiveFailures: failures });
  }

  // DENY — nothing admissible, and no constraint would change that.
  if (!currentRoute) {
    const constraint = proposeConstraint({ preview, policy });
    if (!constraint) {
      return decide('DENY', `no admissible route can reach ${action} under current trust and policy`);
    }
    // A route may exist for a smaller version of the same action.
    return decide('CONSTRAIN', constraint.reason, { constraint: constraint.bound });
  }

  // THROTTLE — permitted, but not this often. Velocity is a consequence in its own right.
  const rateLimit = policy.maxPerWindow?.[severity] ?? policy.maxPerWindow?.default;
  if (rateLimit != null && (history.inWindow ?? 0) >= rateLimit) {
    return decide('THROTTLE', `${history.inWindow} executions of ${severity} actions in this window reached the limit of ${rateLimit}`,
      { inWindow: history.inWindow, limit: rateLimit });
  }

  // ESCALATE — beyond what this principal can authorize at all.
  if (policy.escalateAtOrAbove && severityRank(severity) >= severityRank(policy.escalateAtOrAbove)) {
    return decide('ESCALATE', `${severity} consequences are above this principal's authority and go to ${policy.escalateTo ?? 'a higher authority'}`,
      { escalateTo: policy.escalateTo ?? null });
  }

  // STEP_UP — the same principal may proceed, with stronger evidence.
  const stale = (currentRoute.trustStates ?? []).find((t) => t.evidenceStale);
  if (stale) {
    return decide('STEP_UP', `${stale.agentId}'s evidence is ${stale.evidenceAgeSeconds}s old; re-attest before a ${severity} action`,
      { agent: stale.agentId, maxEvidenceAgeSeconds: stale.maxEvidenceAgeSeconds });
  }
  if (requiresApproval(severity, policy, preview)) {
    return decide('STEP_UP', `policy requires human approval for ${severity} consequences`,
      { approvalRequired: true });
  }

  // CONSTRAIN — admissible, but the blast radius should be bounded first.
  const constraint = proposeConstraint({ preview, policy });
  if (constraint) return decide('CONSTRAIN', constraint.reason, { constraint: constraint.bound });

  // REROUTE — the route changed underneath us, but a trustworthy path remains.
  if (previousRoute && previousRoute.routeId !== currentRoute.routeId) {
    return decide('REROUTE', `${previousRoute.routeId} is no longer admissible; ${currentRoute.routeId} is`,
      { from: previousRoute.routeId, to: currentRoute.routeId });
  }

  return decide('KEEP', 'the selected route is still admissible and nothing material changed',
    { routeId: currentRoute.routeId });
}

// A constraint is only worth proposing when bounding the parameters would genuinely
// change the consequence — not as a way to wave something through.
function proposeConstraint({ preview, policy }) {
  if (!preview) return null;
  const batchLimit = policy.batchLimit ?? 25;
  if (preview.recordsAffected > batchLimit) {
    return {
      reason: `${preview.recordsAffected.toLocaleString('en-US')} records is above the batch limit of ${batchLimit}; bound it and the consequence is recoverable`,
      bound: { max: { recordsAffected: batchLimit } }
    };
  }
  const amountLimit = policy.constrainAmountAbove;
  if (amountLimit != null && preview.financialExposure > amountLimit) {
    return {
      reason: `$${preview.financialExposure.toLocaleString('en-US')} is above the per-execution limit of $${amountLimit}`,
      bound: { max: { amount: amountLimit } }
    };
  }
  return null;
}

const requiresApproval = (severity, policy, preview) =>
  (policy.requireApprovalAtOrAbove
    ? severityRank(severity) >= severityRank(policy.requireApprovalAtOrAbove)
    : severity === 'CRITICAL') ||
  (policy.approvalThresholds?.amount != null && preview?.financialExposure >= policy.approvalThresholds.amount);

// Rerouting may never answer a trust change with a weaker response than the one the
// change warranted — that is how authority expands by accident.
export function reconcile(previousResponse, nextResponse) {
  if (!previousResponse) return nextResponse;
  return isMoreRestrictive(previousResponse.response, nextResponse.response)
    ? { ...previousResponse, reason: `${previousResponse.reason} (a weaker response was proposed and refused)`, refusedWeaker: nextResponse.response }
    : nextResponse;
}
