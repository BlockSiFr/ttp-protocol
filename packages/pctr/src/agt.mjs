import { classifyAction, severityRank } from './consequences.mjs';

// MICROSOFT AGT (Agent Governance Toolkit) BRIDGE.
//
// The contract here is the one defined in docs/integration-guide.md Part 6 and
// docs/ecosystem-integrations.md: AGT enforces pre-execution policy, PCTR/TTP supplies
// the behavioural evidence, trust is recomputed, and AGT consumes the updated evidence
// on the next decision. PCTR therefore reports *evidence*, never a competing verdict —
// building a parallel privilege model is explicitly out of scope.
//
//   1. AGT enforces pre-execution policy
//   2. PCTR observes the consequence, the route and the execution receipt
//   3. Trust is recomputed from that evidence
//   4. AGT consumes it and adjusts the next decision

// Canonical score adapter (integration-guide.md 6.4): AGT components expect 0-1000.
// The original 0-1 score is always carried alongside so telemetry stays auditable.
export function toAgtScore(ttpScore) {
  const clamped = Math.max(0, Math.min(1, Number(ttpScore) || 0));
  return Math.round(clamped * 1000);
}
export const fromAgtScore = (agtScore) =>
  Math.max(0, Math.min(1, (Number(agtScore) || 0) / 1000));

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
      ttp_agt_score: toAgtScore(effectiveTrust),
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

// Normalizes AGT runtime events onto the canonical PCTR events. AGT's own event
// vocabulary is not pinned in this repo, so the mapping is deliberately tolerant about
// field naming and returns null for anything it does not recognise — PCTR never invents
// a security event from a shape it cannot read.
export function normalizeAgtEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const kind = String(e.type ?? e.event ?? e.eventType ?? e.kind ?? '').toLowerCase();
  const agent = e.agentId ?? e.agent_id ?? e.agent ?? e.subject ?? e.principal ?? null;
  const action = e.action ?? e.operation ?? e.tool ?? e.capability ?? e.name ?? null;

  if (/policy.*(decision|evaluat)|authoriz|decision/.test(kind)) {
    const allowed = e.decision === 'allow' || e.allowed === true || e.effect === 'permit';
    return {
      event: allowed ? 'EXECUTION_ALLOWED' : 'EXECUTION_DENIED',
      subject: agent,
      detail: {
        action, reason: e.reason ?? e.message ?? (allowed ? 'AGT policy permitted this action' : 'AGT policy denied this action'),
        policy: e.policy ?? e.policyId ?? e.rule ?? null,
        agtTrustScore: e.trustScore ?? e.agt_trust_score ?? null
      }
    };
  }
  if (/(action|tool|capability).*(request|invoke|propos|call)|invocation/.test(kind)) {
    if (!action) return null;
    const params = e.parameters ?? e.params ?? e.arguments ?? e.input ?? {};
    const c = classifyAction(action, params);
    return { event: 'ACTION_PROPOSED', subject: agent, detail: { action, ...params, consequence: c.consequence, severity: c.severity } };
  }
  if (/delegat|handoff|assign/.test(kind)) {
    const to = e.to ?? e.target ?? e.targetAgent ?? e.delegateTo ?? null;
    return to ? { event: 'AGENT_DELEGATED', subject: agent, detail: { to } } : null;
  }
  if (/register|discover|onboard/.test(kind)) {
    return agent ? { event: 'AGENT_DISCOVERED', subject: agent, detail: { framework: 'microsoft-agt', trust: e.trustScore != null ? fromAgtScore(e.trustScore) : null } } : null;
  }
  if (/trust.*(change|updat|recompute)/.test(kind)) {
    return agent ? {
      event: 'TRUST_CHANGED', subject: agent,
      detail: {
        from: e.previousScore != null ? fromAgtScore(e.previousScore) : null,
        to: e.trustScore != null ? fromAgtScore(e.trustScore) : null,
        reason: e.reason ?? 'AGT recomputed this agent\'s trust'
      }
    } : null;
  }
  if (/complete|finish|result/.test(kind)) {
    return action ? { event: 'EXECUTION_COMPLETED', subject: agent, detail: { action, status: e.error || e.failed ? 'FAILED' : 'SUCCEEDED' } } : null;
  }
  return null;
}
