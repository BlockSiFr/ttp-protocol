import { classifyAction, severityRank } from './consequences.mjs';

// MICROSOFT AGT (Agent Governance Toolkit) BRIDGE.
// Upstream: https://github.com/microsoft/agent-governance-toolkit
//
// Types here follow the toolkit's own definitions in
// agent-governance-typescript/src/types.ts — PolicyAction, PolicyDecisionResult,
// AuditEntry, TrustScore, TrustTier, ExecutionRing, CascadeEvent, RingViolation —
// not a guess at them.
//
// The loop is the one in docs/integration-guide.md Part 6: AGT enforces pre-execution
// policy, PCTR/TTP supplies the behavioural evidence, trust is recomputed, and AGT
// consumes the updated evidence on the next decision. PCTR reports *evidence*, never a
// competing verdict — building a parallel privilege model is explicitly out of scope.
//
//   1. AGT enforces pre-execution policy
//   2. PCTR observes the consequence, the route and the execution receipt
//   3. Trust is recomputed from that evidence
//   4. AGT consumes it and adjusts the next decision

// AGT's TrustScore is 0-1, banded into tiers. Thresholds are the toolkit's own
// defaults (agent-governance-typescript/src/trust.ts): untrusted 0.0, provisional 0.3,
// trusted 0.6, verified 0.85. PCTR's effective trust is already 0-1, so it maps across
// directly — no rescaling, which is the whole point of sharing a scale.
export const AGT_TIER_THRESHOLDS = { untrusted: 0.0, provisional: 0.3, trusted: 0.6, verified: 0.85 };

export function trustTier(score, thresholds = AGT_TIER_THRESHOLDS) {
  const s = clamp01(score);
  if (s >= thresholds.verified) return 'Verified';
  if (s >= thresholds.trusted) return 'Trusted';
  if (s >= thresholds.provisional) return 'Provisional';
  return 'Untrusted';
}

// Produces AGT's TrustScore { overall, dimensions, tier }.
export function toAgtTrustScore(ttpScore, { dimensions = {}, thresholds } = {}) {
  const overall = clamp01(ttpScore);
  return { overall, dimensions, tier: trustTier(overall, thresholds) };
}
export const fromAgtTrustScore = (trustScore) =>
  clamp01(typeof trustScore === 'number' ? trustScore : trustScore?.overall ?? 0);

// The 0-1000 integer scale from integration-guide.md 6.4. Upstream AGT does NOT use it —
// its TrustScore.overall is 0-1 — so this is only for downstream components that the
// guide says expect a 0-1000 scale. Prefer toAgtTrustScore() when talking to AGT itself.
export const toAgtScore = (ttpScore) => Math.round(clamp01(ttpScore) * 1000);
export const fromAgtScore = (agtScore) => clamp01((Number(agtScore) || 0) / 1000);

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

// AGT's ExecutionRing (types.ts): Ring0 is the most privileged. PCTR proposes a ring
// from what the action can cause; AGT's own actionRings config stays authoritative.
export const RING_BY_SEVERITY = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export const ringForSeverity = (severity) => RING_BY_SEVERITY[severity] ?? 3;

// SPIFFE/SVID compatibility (6.3): in SPIFFE-native deployments the SVID URI *is* the
// agent id, so it has to survive round-tripping unmodified.
const SPIFFE = /^spiffe:\/\/([^/]+)(\/.*)?$/;
export const isSpiffeId = (id) => SPIFFE.test(String(id ?? ''));
export function parseSpiffeId(id) {
  const match = SPIFFE.exec(String(id ?? ''));
  return match ? { trustDomain: match[1], path: match[2] ?? '', id: String(id) } : null;
}

// OPA/Rego bridge (6.2): claims exposed under `input.ttp` so AGT policy can evaluate
// current behavioural trust. Rego stays authoritative for allow/deny.
export function agtClaims({ route, preview, receipt, domain, issuerCount, at = new Date().toISOString() }) {
  const effectiveTrust = route?.effectiveTrust ?? route?.selected?.effectiveTrust ?? 0;
  const selected = route?.selected ?? route ?? null;
  const consequence = preview?.consequence ?? receipt?.consequence?.class ?? null;

  return {
    ttp: {
      // Claims named in the Rego example in integration-guide.md 6.2.
      ttp_domain: domain ?? domainFor(consequence),
      ttp_score: Number(effectiveTrust.toFixed?.(4) ?? effectiveTrust),
      issuer_count: issuerCount ?? selected?.trustStates?.length ?? 0,
      // PCTR's additions: what the action can cause, and over which path.
      ttp_agt_score: toAgtScore(effectiveTrust),          // legacy 0-1000 consumers
      trust_score: toAgtTrustScore(effectiveTrust),       // AGT-native TrustScore
      trust_tier: trustTier(effectiveTrust),
      required_ring: ringForSeverity(preview?.severity ?? receipt?.consequence?.severity),
      consequence,
      severity: preview?.severity ?? receipt?.consequence?.severity ?? null,
      reversible: preview?.reversible ?? receipt?.consequence?.reversible ?? null,
      route_id: selected?.routeId ?? receipt?.routeSelected?.routeId ?? null,
      agents: selected?.agents ?? receipt?.routeSelected?.agents ?? [],
      spiffe_ids: (selected?.agents ?? []).filter(isSpiffeId),
      receipt_id: receipt?.receiptId ?? null,
      receipt_hash: receipt?.receiptHash ?? null,
      evaluated_at: at
    }
  };
}

const DOMAIN_BY_CONSEQUENCE = {
  MONEY_MOVED: 'payments', DATA_DELETED: 'data-destruction', SECRET_EXPOSED: 'secrets',
  PRODUCTION_CHANGED: 'prod-change', INFRA_MODIFIED: 'infrastructure', IDENTITY_CHANGED: 'identity',
  ACCESS_GRANTED: 'access', MESSAGE_SENT: 'communications', CONTRACT_EXECUTED: 'contracts',
  PHYSICAL_CHANGED: 'physical', DATA_WRITTEN: 'data-write', DATA_READ: 'data-read'
};
export const domainFor = (consequence) => DOMAIN_BY_CONSEQUENCE[consequence] ?? 'general';

// AgentMesh peer trust attestation bridge (6.5): a PCTR receipt becomes a mesh
// attestation, carrying its identifiers so mesh telemetry stays cryptographically
// traceable back to the execution it describes.
export function toMeshAttestation(receipt, { peer, trustDomain } = {}) {
  if (!receipt) return null;
  return {
    type: 'AgentMeshTrustAttestation',
    version: 1,
    subject: receipt.requestedBy ?? receipt.principal ?? null,
    peer: peer ?? null,
    trustDomain: trustDomain ?? (parseSpiffeId(receipt.principal)?.trustDomain ?? null),
    action: receipt.requested?.action ?? null,
    consequence: receipt.consequence?.class ?? null,
    outcome: receipt.verifier?.decision ?? 'EXECUTION_DENIED',
    trustScore: toAgtTrustScore(receipt.routeSelected?.effectiveTrust ?? 0),
    agtTrustScore: toAgtScore(receipt.routeSelected?.effectiveTrust ?? 0),
    ttpScore: receipt.routeSelected?.effectiveTrust ?? 0,
    evidence: { receiptId: receipt.receiptId, receiptHash: receipt.receiptHash, signedBy: receipt.keyId ?? null },
    issuedAt: receipt.issuedAt
  };
}

// Step 2 of the loop: the behavioural evidence PCTR submits back after execution.
export function toTrustEvidence(receipt, { domain } = {}) {
  if (!receipt) return null;
  const allowed = receipt.verifier?.decision === 'EXECUTION_ALLOWED';
  const severity = receipt.consequence?.severity ?? 'LOW';
  return {
    type: 'TTPBehavioralEvidence',
    version: 1,
    subject: receipt.requestedBy ?? receipt.principal ?? null,
    domain: domain ?? domainFor(receipt.consequence?.class),
    action: receipt.requested?.action ?? null,
    outcome: allowed ? 'allowed' : 'denied',
    // A denial at a high-consequence action is the strongest behavioural signal there
    // is, so it is weighted by what the action could have caused.
    weight: Number(((severityRank(severity) + 1) / 4).toFixed(2)),
    failures: (receipt.verifier?.failures ?? []).map((f) => f.code),
    receiptId: receipt.receiptId,
    receiptHash: receipt.receiptHash,
    observedAt: receipt.executed?.executedAt ?? receipt.issuedAt
  };
}

// Normalizes AGT runtime events onto the canonical PCTR events, reading the toolkit's
// own shapes: PolicyDecisionResult, AuditEntry, CascadeEvent, RingViolation,
// KillSwitchResult and TrustVerificationResult. Anything unrecognised returns null —
// PCTR never invents a security event from a shape it cannot read.

// AGT PolicyAction -> what actually happens to the execution.
const POLICY_ACTION = {
  allow: 'EXECUTION_ALLOWED',
  log: 'EXECUTION_ALLOWED',
  warn: 'EXECUTION_ALLOWED',
  deny: 'EXECUTION_DENIED',
  require_approval: 'EXECUTION_DENIED'   // not denied forever, but not executable yet
};
// AGT LegacyPolicyDecision, used by AuditEntry and the client.
const LEGACY_DECISION = { allow: 'EXECUTION_ALLOWED', deny: 'EXECUTION_DENIED', review: 'EXECUTION_DENIED' };

// CascadeEvent actions all describe trust collapsing around an agent.
const CASCADE_TRUST = {
  circuit_opened: 0.2, agent_degraded: 0.3, agent_quarantined: 0, agent_killed: 0,
  rollback_triggered: 0.4, health_propagated: null
};

export function normalizeAgtEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const agent = e.agentId ?? e.agent_id ?? e.sourceAgentId ?? e.agent ?? e.subject ?? null;
  const action = e.action ?? e.operation ?? e.tool ?? e.capability ?? null;

  // CascadeEvent: { eventId, timestamp, sourceAgentId, affectedAgentIds, action, reason, blastRadius }
  if (e.eventId && Array.isArray(e.affectedAgentIds) && action in CASCADE_TRUST) {
    const to = CASCADE_TRUST[action];
    if (to === null) return null;   // health_propagated is telemetry, not a trust change
    return {
      event: 'TRUST_CHANGED', subject: agent,
      detail: { to, reason: e.reason ?? `AGT cascade containment: ${action}`,
        cascadeAction: action, affected: e.affectedAgentIds, blastRadius: e.blastRadius ?? null }
    };
  }

  // RingViolation: { action, agentRing, requiredRing, message }
  if (e.requiredRing !== undefined && e.agentRing !== undefined) {
    return {
      event: 'EXECUTION_DENIED', subject: agent,
      detail: { action: e.action ?? null, reason: e.message ?? `agent is Ring${e.agentRing}; ${e.action} requires Ring${e.requiredRing}`,
        agentRing: e.agentRing, requiredRing: e.requiredRing }
    };
  }

  // KillSwitchResult: { agentId, action?, reason } with a killed/terminated flag.
  if (e.killed === true || e.terminated === true) {
    return { event: 'TRUST_CHANGED', subject: agent, detail: { to: 0, reason: e.reason ?? 'AGT kill switch engaged' } };
  }

  // PolicyDecisionResult: { allowed, action: PolicyAction, matchedRule?, policyName?, reason?, approvers, rateLimited, evaluatedAt }
  if (typeof e.allowed === 'boolean' && typeof e.action === 'string' && e.action in POLICY_ACTION) {
    const approvalPending = e.action === 'require_approval';
    return {
      event: e.allowed && !approvalPending ? 'EXECUTION_ALLOWED' : POLICY_ACTION[e.action],
      subject: agent,
      detail: {
        action: e.operation ?? e.tool ?? null,
        reason: e.reason ?? (approvalPending ? `AGT requires approval from: ${(e.approvers ?? []).join(', ') || 'an approver'}` : `AGT policy ${e.action}`),
        policy: e.policyName ?? e.matchedRule ?? null,
        policyAction: e.action,
        approvers: e.approvers ?? [],
        rateLimited: e.rateLimited ?? false
      }
    };
  }

  // AuditEntry: { timestamp, agentId, action, decision, hash, previousHash }
  // AGT hash-chains its audit log exactly as PCTR chains receipts, so the chain
  // identifiers are carried through rather than dropped.
  if (e.hash && e.previousHash !== undefined && typeof e.decision === 'string') {
    const mapped = LEGACY_DECISION[e.decision];
    if (!mapped) return null;
    return {
      event: mapped, subject: agent,
      detail: { action: e.action ?? null, decision: e.decision,
        reason: `AGT audit entry records decision "${e.decision}"`,
        auditHash: e.hash, previousHash: e.previousHash,
        skill: e.skillAuditMetadata?.skillName ?? null }
    };
  }

  // TrustVerificationResult: { verified, trustScore: { overall, dimensions, tier }, reason }
  if (typeof e.verified === 'boolean' && e.trustScore) {
    return {
      event: 'TRUST_CHANGED', subject: agent,
      detail: { to: fromAgtTrustScore(e.trustScore), tier: e.trustScore?.tier ?? trustTier(fromAgtTrustScore(e.trustScore)),
        reason: e.reason ?? `AGT trust verification ${e.verified ? 'passed' : 'failed'}` }
    };
  }

  // Discovery and delegation, from the toolkit's agent registry and mesh surfaces.
  const kind = String(e.type ?? e.event ?? e.eventType ?? e.kind ?? '').toLowerCase();
  if (/register|discover|onboard/.test(kind) && agent) {
    return { event: 'AGENT_DISCOVERED', subject: agent,
      detail: { framework: 'microsoft-agt', trust: e.trustScore != null ? fromAgtTrustScore(e.trustScore) : null,
        status: e.status ?? null } };
  }
  if (/delegat|handoff|assign/.test(kind)) {
    const to = e.to ?? e.target ?? e.targetAgent ?? e.delegateTo ?? null;
    return to ? { event: 'AGENT_DELEGATED', subject: agent, detail: { to } } : null;
  }
  // An invocation AGT is about to evaluate: PCTR supplies the consequence it omits.
  if (/(action|tool|capability).*(request|invoke|propos|call)|invocation/.test(kind)) {
    if (!action) return null;
    const params = e.parameters ?? e.params ?? e.arguments ?? e.input ?? {};
    const c = classifyAction(action, params);
    return { event: 'ACTION_PROPOSED', subject: agent,
      detail: { action, ...params, consequence: c.consequence, severity: c.severity, requiredRing: ringForSeverity(c.severity) } };
  }
  if (/complete|finish|result/.test(kind) && action) {
    return { event: 'EXECUTION_COMPLETED', subject: agent, detail: { action, status: e.error || e.failed ? 'FAILED' : 'SUCCEEDED' } };
  }
  return null;
}
