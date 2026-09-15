import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toAgtScore, fromAgtScore, toAgtTrustScore, fromAgtTrustScore, trustTier, AGT_TIER_THRESHOLDS,
  ringForSeverity, isSpiffeId, parseSpiffeId, agtClaims, domainFor, toMeshAttestation, toTrustEvidence
} from '../src/agt.mjs';
import { normalize, ingest } from '../src/adapters.mjs';
import { createTimeline } from '../src/timeline.mjs';
import { buildGraph } from '../src/graph.mjs';
import { protect } from '../src/protect.mjs';
import { previewConsequence } from '../src/twin.mjs';
import { resolveRoute } from '../src/router.mjs';

// The contract under test is docs/integration-guide.md Part 6 (AGT-Native Integration).

const graph = () => buildGraph({
  principal: 'spiffe://blocksifr.com/ns/prod/sa/planner',
  agents: [{
    id: 'spiffe://blocksifr.com/ns/prod/sa/finance', trust: 0.99, evidenceAgeSeconds: 5,
    authority: ['payments.*'], tools: ['payments']
  }],
  tools: [{ id: 'payments', actions: ['payments.transfer'] }],
  actions: [{ id: 'payments.transfer', amount: 1800 }],
  policy: { requireApprovalAtOrAbove: 'CRITICAL' }
});

test('trust maps onto AGT\'s own TrustScore, which is 0-1 with tiers', () => {
  // Upstream AGT (agent-governance-typescript/src/trust.ts) scores 0-1 and bands it:
  // untrusted 0.0, provisional 0.3, trusted 0.6, verified 0.85. PCTR is already 0-1,
  // so it maps across with no rescaling.
  assert.deepEqual(AGT_TIER_THRESHOLDS, { untrusted: 0.0, provisional: 0.3, trusted: 0.6, verified: 0.85 });
  assert.deepEqual(toAgtTrustScore(0.9178), { overall: 0.9178, dimensions: {}, tier: 'Verified' });
  assert.equal(trustTier(0.1), 'Untrusted');
  assert.equal(trustTier(0.3), 'Provisional');
  assert.equal(trustTier(0.6), 'Trusted');
  assert.equal(trustTier(0.85), 'Verified');
  assert.equal(fromAgtTrustScore({ overall: 0.42, tier: 'Provisional' }), 0.42);
  assert.equal(fromAgtTrustScore(0.42), 0.42, 'a bare number is accepted too');
});

test('AGT execution rings are proposed from what the action can cause', () => {
  // ExecutionRing in types.ts: Ring0 is the most privileged.
  assert.equal(ringForSeverity('CRITICAL'), 0);
  assert.equal(ringForSeverity('HIGH'), 1);
  assert.equal(ringForSeverity('MEDIUM'), 2);
  assert.equal(ringForSeverity('LOW'), 3);
  assert.equal(ringForSeverity(undefined), 3);
});

test('the legacy 0-1000 scale stays available for downstream consumers', () => {
  // integration-guide.md 6.4 says some downstream components expect 0-1000. Upstream
  // AGT itself does not — keep the conversion, but it is not the AGT-native path.
  assert.equal(toAgtScore(0.9178), 918);
  assert.equal(toAgtScore(0), 0);
  assert.equal(toAgtScore(1), 1000);
  assert.equal(toAgtScore(1.5), 1000, 'out-of-range input is clamped, not propagated');
  assert.equal(toAgtScore(-2), 0);
  assert.equal(toAgtScore(undefined), 0);
  assert.equal(fromAgtScore(918), 0.918);
  assert.equal(fromAgtScore(2000), 1);
});

test('SPIFFE SVID identities survive round-tripping as agent ids', () => {
  const id = 'spiffe://blocksifr.com/ns/prod/sa/finance-agent';
  assert.equal(isSpiffeId(id), true);
  assert.equal(isSpiffeId('finance-agent'), false);
  assert.deepEqual(parseSpiffeId(id), { trustDomain: 'blocksifr.com', path: '/ns/prod/sa/finance-agent', id });
  assert.equal(parseSpiffeId('not-a-svid'), null);
});

test('Rego claims carry everything the documented policy example evaluates', async () => {
  const g = graph();
  const preview = previewConsequence(g, 'payments.transfer', { amount: 1800 });
  const route = resolveRoute(g, 'payments.transfer');
  const { ttp } = agtClaims({ route, preview, domain: 'prod-change', issuerCount: 2 });

  // The Rego example checks input.ttp.ttp_domain, ttp_score and issuer_count.
  assert.equal(ttp.ttp_domain, 'prod-change');
  assert.equal(typeof ttp.ttp_score, 'number');
  assert.equal(ttp.issuer_count, 2);
  assert.equal(ttp.ttp_agt_score, toAgtScore(ttp.ttp_score));
  assert.equal(ttp.trust_score.tier, trustTier(ttp.ttp_score), 'AGT-native TrustScore travels alongside');
  assert.equal(ttp.required_ring, ringForSeverity(ttp.severity));
  assert.equal(ttp.consequence, 'MONEY_MOVED');
  assert.ok(ttp.spiffe_ids.every(isSpiffeId));
  assert.ok(ttp.spiffe_ids.length, 'SPIFFE agent ids are surfaced for policy');
});

test('the domain defaults from the consequence when AGT does not supply one', () => {
  assert.equal(domainFor('MONEY_MOVED'), 'payments');
  assert.equal(domainFor('DATA_DELETED'), 'data-destruction');
  assert.equal(domainFor('PRODUCTION_CHANGED'), 'prod-change');
  assert.equal(domainFor('SOMETHING_NEW'), 'general');
});

test('a receipt becomes behavioural evidence AGT can consume on the next decision', async () => {
  const run = await protect(graph(), { action: 'payments.transfer', target: 'acct:1', params: { amount: 1800 } },
    { execute: () => 'sent' });
  const evidence = toTrustEvidence(run.receipt);

  assert.equal(evidence.type, 'TTPBehavioralEvidence');
  assert.equal(evidence.outcome, 'allowed');
  assert.equal(evidence.domain, 'payments');
  assert.equal(evidence.receiptHash, run.receipt.receiptHash);
  assert.ok(evidence.weight > 0 && evidence.weight <= 1);

  // A denial at a high-consequence action is the stronger behavioural signal.
  const denied = await protect(graph(), { action: 'payments.transfer', target: 'acct:1', params: { amount: 50000 } });
  const deniedEvidence = toTrustEvidence(denied.receipt);
  assert.equal(deniedEvidence.outcome, 'denied');
  assert.ok(deniedEvidence.weight > evidence.weight);
  assert.ok(deniedEvidence.failures.includes('APPROVAL_REQUIRED'));
});

test('a receipt becomes an AgentMesh attestation that traces back to the execution', async () => {
  const run = await protect(graph(), { action: 'payments.transfer', target: 'acct:1', params: { amount: 1800 } },
    { execute: () => 'sent' });
  const attestation = toMeshAttestation(run.receipt, { peer: 'spiffe://partner.example/ns/prod/sa/mesh' });

  assert.equal(attestation.type, 'AgentMeshTrustAttestation');
  assert.equal(attestation.outcome, 'EXECUTION_ALLOWED');
  assert.equal(attestation.trustDomain, 'blocksifr.com');
  assert.equal(attestation.evidence.receiptId, run.receipt.receiptId);
  assert.equal(attestation.evidence.receiptHash, run.receipt.receiptHash);
  assert.equal(attestation.agtTrustScore, toAgtScore(run.receipt.routeSelected.effectiveTrust));
  assert.equal(attestation.trustScore.tier, trustTier(run.receipt.routeSelected.effectiveTrust));
  assert.equal(toMeshAttestation(null), null);
});

test('AGT PolicyDecisionResult maps every PolicyAction onto a canonical event', () => {
  // PolicyAction in types.ts: allow | deny | warn | require_approval | log
  const decision = (action, allowed, extra = {}) => normalize('agt',
    { allowed, action, agentId: 'finance', operation: 'payments.transfer', policyName: 'agt.authz', rateLimited: false, approvers: [], ...extra });

  assert.equal(decision('allow', true).event, 'EXECUTION_ALLOWED');
  assert.equal(decision('log', true).event, 'EXECUTION_ALLOWED');
  assert.equal(decision('warn', true).event, 'EXECUTION_ALLOWED');
  assert.equal(decision('deny', false).event, 'EXECUTION_DENIED');

  // require_approval is not a denial forever, but it is not executable yet either.
  const pending = decision('require_approval', true, { approvers: ['ops-oncall'] });
  assert.equal(pending.event, 'EXECUTION_DENIED');
  assert.equal(pending.detail.policyAction, 'require_approval');
  assert.deepEqual(pending.detail.approvers, ['ops-oncall']);

  assert.equal(decision('deny', false).detail.policy, 'agt.authz');
});

test('AGT AuditEntry maps its LegacyPolicyDecision and keeps the hash chain', () => {
  // AuditEntry: { timestamp, agentId, action, decision, hash, previousHash }
  const entry = normalize('microsoft-agt',
    { timestamp: '2026-09-15T00:00:00Z', agentId: 'finance', action: 'customers.delete', decision: 'review', hash: 'h1', previousHash: 'h0' });
  assert.equal(entry.event, 'EXECUTION_DENIED', 'review is not an execution');
  assert.equal(entry.detail.auditHash, 'h1');
  assert.equal(entry.detail.previousHash, 'h0', 'AGT hash-chains its audit log as PCTR chains receipts');
  assert.equal(normalize('agt', { agentId: 'a', action: 'x', decision: 'allow', hash: 'h1', previousHash: 'h0' }).event, 'EXECUTION_ALLOWED');
});

test('AGT cascade containment and ring violations are read as what they are', () => {
  // CascadeEvent: { eventId, timestamp, sourceAgentId, affectedAgentIds, action, reason, blastRadius }
  const quarantined = normalize('agt',
    { eventId: 'e1', timestamp: 't', sourceAgentId: 'finance', affectedAgentIds: ['a', 'b'], action: 'agent_quarantined', reason: 'breach detected', blastRadius: 3 });
  assert.equal(quarantined.event, 'TRUST_CHANGED');
  assert.equal(quarantined.detail.to, 0, 'a quarantined agent has no trust left');
  assert.deepEqual(quarantined.detail.affected, ['a', 'b']);
  assert.equal(quarantined.detail.blastRadius, 3);

  // health_propagated is telemetry, not a trust change.
  assert.equal(normalize('agt',
    { eventId: 'e2', timestamp: 't', sourceAgentId: 'finance', affectedAgentIds: [], action: 'health_propagated', reason: 'ok' }), null);

  // RingViolation: { action, agentRing, requiredRing, message }
  const violation = normalize('agt', { agentId: 'finance', action: 'prod.deploy', agentRing: 2, requiredRing: 0, message: 'Ring2 cannot reach Ring0' });
  assert.equal(violation.event, 'EXECUTION_DENIED');
  assert.equal(violation.detail.requiredRing, 0);
});

test('AGT TrustVerificationResult arrives with its tier intact', () => {
  const verification = normalize('agt',
    { verified: false, agentId: 'finance', trustScore: { overall: 0.42, dimensions: {}, tier: 'Provisional' }, reason: 'stale attestation' });
  assert.equal(verification.event, 'TRUST_CHANGED');
  assert.equal(verification.detail.to, 0.42);
  assert.equal(verification.detail.tier, 'Provisional');
});

test('AGT action invocations get the consequence AGT does not describe', () => {
  const proposed = normalize('agt', { type: 'action.invocation', agentId: 'finance', action: 'payments.transfer', parameters: { amount: 18000 } });
  assert.equal(proposed.event, 'ACTION_PROPOSED');
  assert.equal(proposed.detail.consequence, 'MONEY_MOVED');
  assert.equal(proposed.detail.severity, 'CRITICAL');
});

test('unrecognised AGT events are dropped, never invented into security events', () => {
  assert.equal(normalize('agt', { type: 'telemetry.heartbeat', agentId: 'finance' }), null);
  assert.equal(normalize('agt', { type: 'action.invocation', agentId: 'finance' }), null, 'an invocation with no action names nothing');
  assert.equal(normalize('agt', null), null);
  assert.equal(normalize('agt', 'not-an-object'), null);
});

test('an AGT run feeds one timeline alongside every other framework', () => {
  const timeline = createTimeline({ objective: 'Pay invoice INV-4471' });
  ingest('agt', [
    { type: 'agent.registered', agentId: 'spiffe://blocksifr.com/ns/prod/sa/finance', trustScore: { overall: 0.97, dimensions: {}, tier: 'Verified' } },
    { type: 'action.invocation', agentId: 'spiffe://blocksifr.com/ns/prod/sa/finance', action: 'payments.transfer', parameters: { amount: 18000 } },
    { type: 'telemetry.heartbeat' },
    { allowed: false, action: 'deny', agentId: 'spiffe://blocksifr.com/ns/prod/sa/finance', operation: 'payments.transfer', reason: 'above ring threshold', approvers: [], rateLimited: false }
  ], timeline);

  assert.deepEqual(timeline.events.map((e) => e.event),
    ['AGENT_DISCOVERED', 'ACTION_PROPOSED', 'CONSEQUENCE_DETECTED', 'EXECUTION_DENIED']);
  assert.equal(timeline.events[0].detail.trust, 0.97);
});
