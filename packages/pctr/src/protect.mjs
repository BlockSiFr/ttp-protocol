import { previewConsequence, consequenceChanged } from './twin.mjs';
import { resolveRoute } from './router.mjs';
import { issueAuthority, verifyAuthority, createReplayStore } from './authority.mjs';
import { createBoundary } from './boundary.mjs';
import { defaultKeyPair, exportPublic } from './keys.mjs';
import { issueReceipt, verifyReceipt } from './receipt.mjs';
import { attestGraph } from './attest.mjs';
import { severityRank } from './consequences.mjs';
import { createTimeline } from './timeline.mjs';
import { requiresHumanApproval } from './trust.mjs';
import { trustDelta } from './observe.mjs';

// The protected execution loop, end to end:
// PREVIEW -> ROUTE -> AUTHORIZE -> ENFORCE -> RECEIPT, with a replayable timeline.

// Async because a real effect boundary is out of process: enforcement is I/O.
export async function protect(graph, rawRequest, options = {}) {
  const request = { principal: graph.principal, ...rawRequest };
  // Local development mode pins the in-process signer explicitly. A remote
  // boundary independently pins its own keys; it must never inherit this signer.
  const signer = options.keyPair ?? defaultKeyPair();
  const {
    objective = null, approval = null, execute = null, clock,
    replayStore = createReplayStore(), timeline = createTimeline({ objective, clock }), priorReceiptHash = null,
    boundary = createBoundary({ replayStore, publicKey: options.publicKey ?? exportPublic(signer.publicKey), trustedKeyIds: options.trustedKeyIds }),
    keyPair = signer
  } = options;
  const t = timeline;
  const policy = { ...(graph.manifest.policy ?? {}), ...(options.policy ?? {}) };

  // A caller may hand us a timeline that is already running; state the objective once.
  const started = t.last('AGENT_STARTED')
    ?? t.record('AGENT_STARTED', { objective }, { subject: request.agent ?? graph.principal });
  const proposed = t.record('ACTION_PROPOSED', { action: request.action, ...request.params }, { subject: request.agent ?? null, because: [started.id] });

  // PREVIEW — what will this cause? A caller that has already measured the consequence
  // with a probe passes it in; otherwise it is computed from the graph.
  const baseline = previewConsequence(graph, request.action, request.params ?? {});
  const preview = options.preview ?? baseline;
  // A model, probe or caller may raise risk, but never silently downgrade the
  // local conservative consequence classification at the actual effect boundary.
  if (severityRank(preview.severity) < severityRank(baseline.severity)) {
    const denied = t.record('EXECUTION_DENIED', { reason: 'CONSEQUENCE_UNDERSTATED' }, { because: [proposed.id] });
    return finish({ t, request, preview: baseline, route: null, authority: null, keyPair: signer,
      verification: { decision: 'EXECUTION_DENIED', failures: [{ code: 'CONSEQUENCE_UNDERSTATED', message: 'reported consequence is less severe than the conservative baseline' }] },
      result: null, policy: graph.manifest.policy ?? {}, priorReceiptHash, deniedAt: denied.id });
  }
  const detected = t.record('CONSEQUENCE_DETECTED',
    { consequence: preview.consequence, severity: preview.severity, reversible: preview.reversible, blastRadius: preview.blastRadius.band },
    { because: [proposed.id] });

  // ROUTE — which trustworthy path may get there?
  let measurements = options.measurements;
  // An actual HIGH/CRITICAL effect cannot be authorized from manifest assertions.
  // Only independently pinned, valid receipt signatures may become evidence.
  // A caller-supplied measurement object is NOT sufficient for live effects.
  if (execute && severityRank(preview.severity) >= severityRank('HIGH')) {
    const verified = (options.evidenceReceipts ?? []).filter((receipt) => {
      const proof = verifyReceipt(receipt, {
        publicKey: options.trustedEvidencePublicKey,
        trustedKeyIds: options.trustedEvidenceKeyIds
      });
      const issued = Date.parse(receipt.issuedAt);
      const nowMs = Date.parse(options.at ?? new Date().toISOString());
      const freshness = preview.severity === 'CRITICAL' ? 300000 : 900000;
      return proof.valid && proof.signerVerified && receipt.executed?.status === 'SUCCEEDED' &&
        receipt.verifier?.decision === 'EXECUTION_ALLOWED' &&
        Number.isFinite(issued) && Number.isFinite(nowMs) && issued <= nowMs &&
        nowMs - issued <= freshness;
    });
    if (!verified.length) {
      const denied = t.record('EXECUTION_DENIED', { reason: 'SIGNED_BEHAVIORAL_EVIDENCE_REQUIRED' }, { because: [detected.id] });
      return finish({ t, request, preview, route: null, authority: null, keyPair: signer,
        verification: { decision: 'EXECUTION_DENIED', failures: [{ code: 'SIGNED_BEHAVIORAL_EVIDENCE_REQUIRED', message: 'high-consequence execution requires trusted, signed behavioral receipts' }] },
        result: null, policy, priorReceiptHash, deniedAt: denied.id });
    }
    const measured = await attestGraph(graph, {
      receipts: verified, severity: preview.severity, at: options.at,
      trustedReceiptKeyIds: options.trustedEvidenceKeyIds ?? [],
      trustedReceiptPublicKey: options.trustedEvidencePublicKey ?? null
    });
    measurements = Object.fromEntries(measured.measurements.map((m) => [m.agentId, m]));
  }
  const route = resolveRoute(graph, request.action, { policy, severity: preview.severity, target: request.target, at: options.at, measurements });
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

  // Never claim success before an asynchronous tool has actually settled.
  // A rejected tool call is a FAILED effect, even if authorization was PERMIT.
  let result = { status: 'SIMULATED', output: null, executedAt: options.at ?? new Date().toISOString() };
  if (execute) {
    try {
      const output = await execute(execution);
      result = { status: 'SUCCEEDED', output, executedAt: options.at ?? new Date().toISOString() };
    } catch {
      result = { status: 'FAILED', output: null, executedAt: options.at ?? new Date().toISOString() };
    }
  }
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
