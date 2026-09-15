import test from 'node:test';
import assert from 'node:assert/strict';

import { toAgtScore, fromAgtScore, isSpiffeId, parseSpiffeId, agtClaims, domainFor, toMeshAttestation, toTrustEvidence } from '../src/agt.mjs';
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

test('the canonical score adapter maps 0-1 onto AGT\'s 0-1000 scale', () => {
  // integration-guide.md 6.4: agt_trust_score = round(ttp_score * 1000)
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
  assert.equal(toMeshAttestation(null), null);
});

test('AGT policy decisions normalize onto canonical events', () => {
  const allowed = normalize('agt', { type: 'policy.decision', decision: 'allow', agentId: 'finance', action: 'payments.transfer', policy: 'agt.authz' });
  assert.equal(allowed.event, 'EXECUTION_ALLOWED');
  assert.equal(allowed.detail.policy, 'agt.authz');

  const denied = normalize('microsoft-agt', { type: 'policyEvaluation', decision: 'deny', agent_id: 'finance', action: 'customers.delete', reason: 'ring 0 requires approval' });
  assert.equal(denied.event, 'EXECUTION_DENIED');
  assert.equal(denied.detail.reason, 'ring 0 requires approval');
});

test('AGT action invocations get the consequence AGT does not describe', () => {
  const proposed = normalize('agt', { type: 'action.invocation', agentId: 'finance', action: 'payments.transfer', parameters: { amount: 18000 } });
  assert.equal(proposed.event, 'ACTION_PROPOSED');
  assert.equal(proposed.detail.consequence, 'MONEY_MOVED');
  assert.equal(proposed.detail.severity, 'CRITICAL');
});

test('AGT trust updates arrive on PCTR\'s 0-1 scale', () => {
  const changed = normalize('agt', { type: 'trust.updated', agentId: 'finance', previousScore: 940, trustScore: 610 });
  assert.equal(changed.event, 'TRUST_CHANGED');
  assert.equal(changed.detail.from, 0.94);
  assert.equal(changed.detail.to, 0.61);
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
    { type: 'agent.registered', agentId: 'spiffe://blocksifr.com/ns/prod/sa/finance', trustScore: 970 },
    { type: 'action.invocation', agentId: 'spiffe://blocksifr.com/ns/prod/sa/finance', action: 'payments.transfer', parameters: { amount: 18000 } },
    { type: 'telemetry.heartbeat' },
    { type: 'policy.decision', decision: 'deny', agentId: 'spiffe://blocksifr.com/ns/prod/sa/finance', action: 'payments.transfer', reason: 'above ring threshold' }
  ], timeline);

  assert.deepEqual(timeline.events.map((e) => e.event),
    ['AGENT_DISCOVERED', 'ACTION_PROPOSED', 'CONSEQUENCE_DETECTED', 'EXECUTION_DENIED']);
  assert.equal(timeline.events[0].detail.trust, 0.97);
});
