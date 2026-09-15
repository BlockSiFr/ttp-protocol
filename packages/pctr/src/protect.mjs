import { previewConsequence, consequenceChanged } from './twin.mjs';
import { resolveRoute } from './router.mjs';
import { issueAuthority, verifyAuthority, createReplayStore } from './authority.mjs';
import { createBoundary } from './boundary.mjs';
import { issueReceipt } from './receipt.mjs';
import { createTimeline } from './timeline.mjs';
import { requiresHumanApproval } from './trust.mjs';
import { trustDelta } from './observe.mjs';

// The protected execution loop, end to end:
// PREVIEW -> ROUTE -> AUTHORIZE -> ENFORCE -> RECEIPT, with a replayable timeline.

// Async because a real effect boundary is out of process: enforcement is I/O.
export async function protect(graph, rawRequest, options = {}) {
  const request = { principal: graph.principal, ...rawRequest };
  const {
    objective = null, approval = null, execute = null, clock,
    replayStore = createReplayStore(), timeline = createTimeline({ objective, clock }), priorReceiptHash = null,
    boundary = createBoundary({ replayStore, publicKey: options.publicKey, trustedKeyIds: options.trustedKeyIds }),
    keyPair
  } = options;
  const t = timeline;
  const policy = { ...(graph.manifest.policy ?? {}), ...(options.policy ?? {}) };

  // A caller may hand us a timeline that is already running; state the objective once.
  const started = t.last('AGENT_STARTED')
    ?? t.record('AGENT_STARTED', { objective }, { subject: request.agent ?? graph.principal });
  const proposed = t.record('ACTION_PROPOSED', { action: request.action, ...request.params }, { subject: request.agent ?? null, because: [started.id] });

  // PREVIEW — what will this cause? A caller that has already measured the consequence
  // with a probe passes it in; otherwise it is computed from the graph.
  const preview = options.preview ?? previewConsequence(graph, request.action, request.params ?? {});
  const detected = t.record('CONSEQUENCE_DETECTED',
    { consequence: preview.consequence, severity: preview.severity, reversible: preview.reversible, blastRadius: preview.blastRadius.band },
    { because: [proposed.id] });

  // ROUTE — which trustworthy path may get there?
  const route = resolveRoute(graph, request.action, { policy, severity: preview.severity, target: request.target, at: options.at });
  if (!route.selected) {
    const reason = route.candidates.length
      ? route.candidates[0].rejections.map((r) => r.message).join('; ')
      : `no agent in this graph can reach ${request.action}`;
    const denied = t.record('EXECUTION_DENIED', { reason, failures: route.candidates.flatMap((c) => c.rejections) }, { because: [detected.id] });
    return finish({ t, request, preview, route: null, authority: null,
      verification: { decision: 'EXECUTION_DENIED', failures: [{ code: 'NO_ADMISSIBLE_ROUTE', message: reason }] },
      result: null, policy, priorReceiptHash, deniedAt: denied.id });
  }
  // If this timeline already rode a route for this action, say what changed and why the
  // old one no longer holds, before recording the replacement.
  const previous = [...t.events].reverse().find((e) => e.event === 'ROUTE_SELECTED' && e.detail.action === request.action);
  const causes = [detected.id];
  if (previous) {
    // Compare the agents that carried the previous route against their state *now* —
    // otherwise a reroute hides the very trust change that caused it.
    const priorRouteNow = route.candidates.find((c) => c.routeId === previous.detail.routeId)?.trustStates ?? [];
    const currentStates = [...priorRouteNow, ...route.selected.trustStates];
    for (const change of trustDelta(previous.detail.trustStates, currentStates)) {
      causes.push(t.record('TRUST_CHANGED', change, { subject: change.agentId, because: [detected.id] }).id);
    }
    if (previous.detail.routeId !== route.selected.routeId) {
      const stale = route.candidates.find((c) => c.routeId === previous.detail.routeId);
      causes.push(t.record('ROUTE_INVALIDATED', {
        routeId: previous.detail.routeId,
        reason: stale?.rejections.length
          ? stale.rejections.map((x) => x.message).join('; ')
          : 'a more trustworthy admissible route became available',
        policy: policyRef(policy)
      }, { because: [previous.id, detected.id] }).id);
    }
  }
  const selected = t.record('ROUTE_SELECTED',
    { action: request.action, routeId: route.selected.routeId, effectiveTrust: route.selected.effectiveTrust,
      rejected: route.candidates.length - route.admissible.length, trustStates: route.selected.trustStates },
    { because: causes });

  // AUTHORIZE — human approval first where the consequence demands it.
  const needsApproval = requiresHumanApproval(preview.severity, policy) ||
    (policy.approvalThresholds?.amount != null && Number(request.params?.amount ?? 0) >= policy.approvalThresholds.amount);
  if (needsApproval && !approval) {
    const reason = `policy requires human approval for ${preview.severity} consequences`;
    const denied = t.record('EXECUTION_DENIED', { reason, policy: policyRef(policy) }, { because: [detected.id, selected.id] });
    return finish({ t, request, preview, route: route.selected, authority: null, keyPair,
      verification: { decision: 'EXECUTION_DENIED', failures: [{ code: 'APPROVAL_REQUIRED', message: reason }] },
      result: null, policy, priorReceiptHash, deniedAt: denied.id });
  }

  const hops = route.selected.agents;
  for (let i = 1; i < hops.length; i++) {
    t.record('AGENT_DELEGATED', { to: hops[i], forAction: request.action }, { subject: hops[i - 1], because: [selected.id] });
  }
  const tool = route.selected.path.at(-2);
  if (tool) t.record('CAPABILITY_DISCOVERED', { tool, actions: [request.action] }, { subject: hops.at(-1) ?? null, because: [selected.id] });

  const requested = t.record('AUTHORITY_REQUESTED', { action: request.action }, { because: [selected.id] });
  const authority = issueAuthority({
    principal: graph.principal, delegator: route.selected.agents.at(-2) ?? null, session: t.runId,
    action: request.action, target: request.target ?? request.action, params: request.params ?? {},
    constraints: { ...(options.constraints ?? {}), requiresApproval: Boolean(needsApproval),
      materialParams: options.materialParams ?? Object.keys(request.params ?? {}) },
    policyVersion: policyRef(policy), consequence: preview.consequence, route: route.selected,
    validForSeconds: options.validForSeconds ?? 300, issuedAt: options.at,
    ...(keyPair ? { keyPair } : {})
  });
  const issued = t.record('AUTHORITY_ISSUED', { bindingHash: authority.bindingHash, expiresAt: authority.expiresAt }, { because: [requested.id] });

  // ENFORCE — the effect boundary verifies independently of the requesting agent.
  t.record('EXECUTION_REQUESTED', { action: request.action }, { subject: request.agent ?? null, because: [issued.id] });
  const execution = { action: request.action, target: request.target ?? request.action, params: request.params ?? {}, principal: graph.principal, approval };
  const verification = await boundary.verify(authority, execution, { now: options.at });
  if (!verification.allowed) {
    const denied = t.record('EXECUTION_DENIED', { failures: verification.failures, reason: verification.failures.map((f) => f.message).join('; ') }, { because: [issued.id] });
    return finish({ t, request, preview, route: route.selected, authority, verification, result: null, policy, priorReceiptHash, deniedAt: denied.id, keyPair });
  }
  const allowed = t.record('EXECUTION_ALLOWED', { bindingHash: authority.bindingHash }, { because: [issued.id] });

  const result = execute
    ? { status: 'SUCCEEDED', output: execute(execution), executedAt: options.at ?? new Date().toISOString() }
    : { status: 'SIMULATED', output: null, executedAt: options.at ?? new Date().toISOString() };
  t.record('EXECUTION_COMPLETED', { action: request.action, status: result.status }, { because: [allowed.id] });

  return finish({ t, request, preview, route: route.selected, authority, verification, result, policy, priorReceiptHash, routeResult: route, keyPair });
}

function finish({ t, request, preview, route, authority, verification, result, policy, priorReceiptHash, routeResult, deniedAt, keyPair }) {
  const receipt = issueReceipt({ request, preview, route, authority, verification, result, policyVersion: policyRef(policy), priorReceiptHash, ...(keyPair ? { keyPair } : {}) });
  t.record('RECEIPT_ISSUED', { receiptId: receipt.receiptId, receiptHash: receipt.receiptHash },
    { because: deniedAt ? [deniedAt] : [t.last('EXECUTION_COMPLETED')?.id].filter(Boolean) });
  return { allowed: Boolean(verification?.allowed), preview, route, routeResult, authority, verification, result, receipt, timeline: t };
}

const policyRef = (policy) => policy.version ?? 'local-v1';

// Simulation runs the whole loop without ever executing an effect.
export const simulate = (graph, request, options = {}) => protect(graph, request, { ...options, execute: null });
export { verifyAuthority };
export { consequenceChanged };
