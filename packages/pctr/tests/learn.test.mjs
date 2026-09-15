import test from 'node:test';
import assert from 'node:assert/strict';

import { learn, applyProposal } from '../src/learn.mjs';
import { buildGraph } from '../src/graph.mjs';
import { protect } from '../src/protect.mjs';
import { previewConsequence } from '../src/twin.mjs';

const manifest = () => ({
  principal: 'user:test',
  agents: [{ id: 'planner', trust: 0.99, evidenceAgeSeconds: 5, authority: ['*'], tools: ['payments'] }],
  tools: [{ id: 'payments', actions: ['payments.transfer'] }],
  actions: [{ id: 'payments.transfer', amount: 1800 }],
  policy: { requireApprovalAtOrAbove: 'CRITICAL', approvalThresholds: { amount: 5000 }, batchLimit: 25 }
});

const receipt = (over = {}) => ({
  receiptId: `r-${Math.random().toString(36).slice(2, 8)}`,
  requested: { action: 'payments.transfer', target: 't', params: {} },
  routeSelected: { routeId: 'user:test -> planner -> payments -> payments.transfer', agents: ['planner'] },
  verifier: { decision: 'EXECUTION_ALLOWED', failures: [] },
  issuedAt: '2026-09-15T00:00:00Z',
  ...over
});

test('the loop compounds: what executed teaches the map what it got wrong', async () => {
  const graph = buildGraph(manifest());
  // Declared $1,800. Observed $18,000, repeatedly.
  const receipts = Array.from({ length: 3 }, () =>
    receipt({ requested: { action: 'payments.transfer', target: 't', params: { amount: 18000 } } }));

  const result = learn({ graph, receipts });
  const understated = result.findings.find((f) => f.type === 'UNDERSTATED_CONSEQUENCE');
  assert.ok(understated, 'expected the declared amount to be challenged');
  assert.equal(understated.confidence, 'HIGH');
  assert.equal(understated.proposal.updateAction.amount, 18000);

  // Applying it changes what the very next preview concludes, with no arguments passed.
  const before = previewConsequence(graph, 'payments.transfer');
  assert.equal(before.severity, 'HIGH');

  const { manifest: updated, applied } = applyProposal(graph.manifest, result.proposal);
  assert.ok(applied.some((a) => a.includes('payments.transfer')));
  const after = previewConsequence(buildGraph(updated), 'payments.transfer');
  assert.equal(after.severity, 'CRITICAL', 'the system is better informed than it was before the runs');
});

test('an action that executed but was never declared is surfaced with its tool', () => {
  const graph = buildGraph(manifest());
  const receipts = [receipt({
    requested: { action: 'customers.delete', target: 't', params: {} },
    routeSelected: { routeId: 'user:test -> planner -> payments -> customers.delete', agents: ['planner'] }
  })];
  const finding = learn({ graph, receipts }).findings.find((f) => f.type === 'UNDECLARED_ACTION');
  assert.equal(finding.action, 'customers.delete');
  assert.equal(finding.confidence, 'HIGH', 'an undeclared destructive action is not a footnote');
  assert.equal(finding.proposal.addAction.tool, 'payments');

  // Applying attaches it to the tool, which is what actually puts it in the graph.
  const { manifest: updated } = applyProposal(graph.manifest, learn({ graph, receipts }).proposal);
  assert.ok(updated.tools.find((t) => t.id === 'payments').actions.includes('customers.delete'));
  assert.ok(buildGraph(updated).nodes.has('customers.delete'));
});

test('wildcard authority is measured against what was actually used', () => {
  const graph = buildGraph(manifest());
  const receipts = Array.from({ length: 6 }, () => receipt());
  const finding = learn({ graph, receipts }).findings.find((f) => f.type === 'BROAD_AUTHORITY');
  assert.equal(finding.agent, 'planner');
  assert.deepEqual(finding.proposal.updateAgent.authority, ['payments.transfer']);
});

test('approval that is always granted is reported as a rubber stamp', () => {
  const graph = buildGraph(manifest());
  const receipts = Array.from({ length: 5 }, () => receipt({
    authorityBound: { constraints: { requiresApproval: true } },
    verifier: { decision: 'EXECUTION_ALLOWED', failures: [] }
  }));
  const finding = learn({ graph, receipts }).findings.find((f) => f.type === 'APPROVAL_ALWAYS_GRANTED');
  assert.ok(finding);
  assert.match(finding.detail, /click through/);
});

test('repeated denials for the same reason are surfaced, not buried', () => {
  const graph = buildGraph(manifest());
  const receipts = Array.from({ length: 4 }, () => receipt({
    verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'APPROVAL_REQUIRED', message: 'no approval' }] }
  }));
  const finding = learn({ graph, receipts }).findings.find((f) => f.type === 'REPEATED_DENIAL');
  assert.equal(finding.code, 'APPROVAL_REQUIRED');
  assert.equal(finding.occurrences, 4);
});

test('learning claims nothing from too little evidence', () => {
  const graph = buildGraph(manifest());
  const result = learn({ graph, receipts: [receipt()] });
  assert.equal(result.findings.some((f) => f.type === 'BROAD_AUTHORITY'), false, 'one receipt is not a pattern');
  assert.equal(result.findings.some((f) => f.type === 'APPROVAL_ALWAYS_GRANTED'), false);
});

test('an empty history teaches nothing and says so', () => {
  const result = learn({ graph: buildGraph(manifest()), receipts: [], runs: [] });
  assert.equal(result.proposal.empty, true);
  assert.equal(result.observations.receipts, 0);
});

test('findings never edit the manifest on their own', async () => {
  const graph = buildGraph(manifest());
  const original = JSON.stringify(graph.manifest);
  const result = learn({ graph, receipts: Array.from({ length: 3 }, () => receipt({ requested: { action: 'payments.transfer', target: 't', params: { amount: 18000 } } })) });
  assert.ok(result.findings.length);
  assert.equal(JSON.stringify(graph.manifest), original, 'learning proposes; applying is a separate, explicit act');
});

test('real runs feed the loop end to end', async () => {
  const graph = buildGraph(manifest());
  const receipts = [];
  for (let i = 0; i < 4; i++) {
    const run = await protect(graph, { action: 'payments.transfer', target: 'acct:1', params: { amount: 18000 } });
    receipts.push(run.receipt);
  }
  const result = learn({ graph, receipts });
  assert.ok(result.findings.some((f) => f.type === 'UNDERSTATED_CONSEQUENCE'));
  assert.ok(result.findings.some((f) => f.type === 'REPEATED_DENIAL'), 'four unapproved CRITICAL attempts is a pattern');
});
