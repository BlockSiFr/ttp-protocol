import { pathsToAction } from './graph.mjs';
import { agentTrustNow, meetsThreshold, TRUST_REQUIRED, requiresHumanApproval } from './trust.mjs';
import { verify_trust_route } from './ttp.mjs';

// Trust Routing is not shortest-path routing. Admissibility first; optimization only
// among routes that are already authorized, trustworthy and consequence-compatible.
// A security constraint is never traded away for a cheaper or faster route.

const holdsAuthority = (agent, actionId) =>
  (agent.authority ?? []).some((a) => a === '*' || a === actionId || (a.endsWith('.*') && actionId.startsWith(a.slice(0, -1))));

export function resolveRoute(graph, actionId, options = {}) {
  const action = graph.nodes.get(actionId);
  if (!action || action.type !== 'action') {
    return { selected: null, candidates: [], error: `Unknown action: ${actionId}` };
  }
  const policy = { ...(graph.manifest.policy ?? {}), ...(options.policy ?? {}) };
  const severity = options.severity ?? action.severity;
  const at = options.at ?? new Date().toISOString();

  const candidates = pathsToAction(graph, actionId).map((path) => {
    const agents = path.filter((id) => graph.nodes.get(id)?.type === 'agent').map((id) => graph.nodes.get(id));
    const rejections = [];
    const trustStates = agents.map((a) => agentTrustNow(a, { severity, at, decayConstant: policy.decayConstant }));

    // 1. remove unauthorized routes
    for (const a of agents) {
      if (!holdsAuthority(a, actionId)) {
        rejections.push({ code: 'INSUFFICIENT_AUTHORITY', agent: a.id,
          message: `${a.id} does not hold authority for ${actionId}` });
      }
    }
    // 2. remove untrustworthy routes (including stale evidence)
    for (const t of trustStates) {
      if (t.evidenceStale) {
        rejections.push({ code: 'STALE_EVIDENCE', agent: t.agentId,
          message: `${t.agentId} evidence is ${t.evidenceAgeSeconds}s old; ${severity} actions require evidence under ${t.maxEvidenceAgeSeconds}s` });
      }
    }
    const depth = Math.max(0, agents.length - 1);
    const perHop = policy.decayPerHop ?? 0.05;
    const effectiveTrust = trustStates.length
      ? Number(Math.max(0, Math.min(...trustStates.map((t) => t.trust)) - perHop * depth).toFixed(4))
      : 0;
    if (!meetsThreshold(effectiveTrust, severity)) {
      rejections.push({ code: 'TRUST_BELOW_THRESHOLD',
        message: `effective trust ${effectiveTrust} is below the ${TRUST_REQUIRED[severity]} required for ${severity} consequences` });
    }
    // 3. remove consequence-incompatible routes
    const allowed = policy.jurisdictions?.[action.consequence];
    for (const a of agents) {
      if (allowed && a.jurisdiction && !allowed.includes(a.jurisdiction)) {
        rejections.push({ code: 'JURISDICTION_INCOMPATIBLE', agent: a.id,
          message: `${a.id} operates in ${a.jurisdiction}; ${action.consequence} is limited to ${allowed.join(', ')}` });
      }
      if (a.available === false) {
        rejections.push({ code: 'AGENT_UNAVAILABLE', agent: a.id, message: `${a.id} is unavailable` });
      }
    }
    // 4. remove policy-invalid routes (protocol-level route check via TTP)
    const ttp = verify_trust_route({
      routeId: path.join('>'),
      hops: agents.map((a) => ({ subject: a.id, issuer: a.issuer ?? graph.principal, trustScore: a.trust ?? 0 })),
      maxHops: policy.maxHops ?? 6,
      decayPerHop: perHop,
      minIntermediateTrust: policy.minIntermediateTrust ?? 0,
      sourceDomain: policy.sourceDomain ?? 'local',
      targetDomain: policy.targetDomain ?? 'local',
      action: actionId,
      resource: options.target ?? action.target ?? actionId,
      routePolicy: policy.routePolicy
    });
    for (const f of ttp.failureReasons) rejections.push({ code: f.code, message: f.message });

    const latencyMs = agents.reduce((s, a) => s + (a.latencyMs ?? 0), 0);
    const costUnits = agents.reduce((s, a) => s + (a.costUnits ?? 0), 0);
    return {
      routeId: path.join(' -> '), path, agents: agents.map((a) => a.id), hops: path.length,
      effectiveTrust, trustStates, latencyMs, costUnits,
      routeHash: ttp.routeHash, admissible: rejections.length === 0, rejections
    };
  });

  // 5. optimize only what survived
  const admissible = candidates.filter((c) => c.admissible).sort((a, b) =>
    b.effectiveTrust - a.effectiveTrust || a.latencyMs - b.latencyMs || a.costUnits - b.costUnits || a.hops - b.hops);

  const selected = admissible[0] ?? null;
  return {
    action: actionId, severity, consequence: action.consequence, at,
    selected, admissible, candidates,
    requiresApproval: requiresHumanApproval(severity, policy),
    trustRequired: TRUST_REQUIRED[severity]
  };
}

// Authority MUST NOT silently expand during rerouting: a replacement route may never
// be admitted on weaker grounds than the route it replaces.
export function reroute(graph, actionId, previous, options = {}) {
  const next = resolveRoute(graph, actionId, options);
  if (previous?.selected && next.selected) {
    if (next.severity !== previous.severity || next.trustRequired < previous.trustRequired) {
      return { ...next, selected: null, expansionBlocked: true,
        reason: 'replacement route would have required weaker authority than the route it replaces' };
    }
  }
  return { ...next, replaced: previous?.selected?.routeId ?? null };
}
