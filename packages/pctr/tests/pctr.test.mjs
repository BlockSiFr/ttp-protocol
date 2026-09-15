import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyAction } from '../src/consequences.mjs';
import { buildGraph, pathsToAction, reachableActions, protectedActions, summarize } from '../src/graph.mjs';
import { previewConsequence, consequenceChanged } from '../src/twin.mjs';
import { resolveRoute, reroute } from '../src/router.mjs';
import { issueAuthority, verifyAuthority, createReplayStore } from '../src/authority.mjs';
import { issueReceipt, verifyReceipt, verifyReceiptChain } from '../src/receipt.mjs';
import { createTimeline, why, compare, fork, replay } from '../src/timeline.mjs';
import { protect, simulate } from '../src/protect.mjs';
import { generateKeyPair, exportPublic } from '../src/keys.mjs';

const manifest = () => ({
  principal: 'user:test',
  agents: [
    { id: 'planner', trust: 0.98, evidenceAgeSeconds: 10, authority: ['*'], jurisdiction: 'eu', latencyMs: 50, tools: [], delegatesTo: ['finance-a', 'finance-d'] },
    { id: 'finance-a', trust: 0.97, evidenceAgeSeconds: 4200, authority: ['payments.*'], jurisdiction: 'eu', latencyMs: 10, tools: ['payments'] },
    { id: 'finance-d', trust: 0.97, evidenceAgeSeconds: 20, authority: ['payments.*'], jurisdiction: 'eu', latencyMs: 90, tools: ['payments'] }
  ],
  tools: [{ id: 'payments', protocol: 'mcp', actions: ['payments.transfer', 'reports.read'] }],
  actions: [{ id: 'payments.transfer', amount: 1800 }],
  policy: { requireApprovalAtOrAbove: 'CRITICAL', approvalThresholds: { amount: 5000 }, maxHops: 6, decayPerHop: 0.05 }
});
const graph = () => buildGraph(manifest());

test('consequences are classified from what the action can cause', () => {
  assert.equal(classifyAction('customers.delete').consequence, 'DATA_DELETED');
  assert.equal(classifyAction('payments.transfer').consequence, 'MONEY_MOVED');
  assert.equal(classifyAction('reports.read').protected, false);
  // Scale raises severity even when the verb looks benign.
  assert.equal(classifyAction('records.update', { recordsAffected: 5000 }).severity, 'CRITICAL');
});

test('the graph maps consequences backward to every principal that can reach them', () => {
  const g = graph();
  const paths = pathsToAction(g, 'payments.transfer');
  assert.equal(paths.length, 2);
  for (const p of paths) assert.equal(p[0], 'user:test');
  assert.equal(reachableActions(g, 'planner').length, 4);
  assert.equal(protectedActions(g)[0].id, 'payments.transfer');
  assert.equal(summarize(g).agents, 3);
});

test('consequence twin reports blast radius and recommends controls before execution', () => {
  const p = previewConsequence(graph(), 'payments.transfer', { amount: 18000 });
  assert.equal(p.severity, 'CRITICAL');
  assert.equal(p.reversible, false);
  assert.equal(p.financialExposure, 18000);
  assert.equal(p.routesThatCanReachIt, 2);
  assert.ok(p.recommendations.some((r) => r.includes('5,000')));
  assert.ok(consequenceChanged(previewConsequence(graph(), 'payments.transfer', { amount: 1800 }), p));
});

test('routing removes stale evidence before it optimizes for latency', () => {
  const r = resolveRoute(graph(), 'payments.transfer');
  assert.equal(r.selected.agents.at(-1), 'finance-d');
  const rejected = r.candidates.find((c) => c.agents.includes('finance-a'));
  assert.ok(rejected.rejections.some((x) => x.code === 'STALE_EVIDENCE'));
  // finance-a is the faster route and is still not selected: security is not traded for latency.
  assert.ok(rejected.latencyMs < r.selected.latencyMs);
});

test('routing removes routes whose agents lack authority for the action', () => {
  const m = manifest();
  m.agents[2].authority = ['reports.read'];
  const r = resolveRoute(buildGraph(m), 'payments.transfer');
  assert.equal(r.selected, null);
  assert.ok(r.candidates.flatMap((c) => c.rejections).some((x) => x.code === 'INSUFFICIENT_AUTHORITY'));
});

test('routing removes consequence-incompatible jurisdictions', () => {
  const m = manifest();
  m.policy.jurisdictions = { MONEY_MOVED: ['us'] };
  const r = resolveRoute(buildGraph(m), 'payments.transfer');
  assert.equal(r.selected, null);
  assert.ok(r.candidates.flatMap((c) => c.rejections).some((x) => x.code === 'JURISDICTION_INCOMPATIBLE'));
});

test('authority never silently expands during rerouting', () => {
  const g = graph();
  const previous = resolveRoute(g, 'payments.transfer');
  const next = reroute(g, 'payments.transfer', previous, { severity: 'MEDIUM' });
  assert.equal(next.selected, null);
  assert.equal(next.expansionBlocked, true);
});

test('authority binds the exact execution, not the credential', () => {
  const g = graph();
  const route = resolveRoute(g, 'payments.transfer').selected;
  const authority = issueAuthority({
    principal: 'user:test', action: 'payments.transfer', target: 'acct:9931',
    params: { amount: 1800 }, consequence: 'MONEY_MOVED', route
  });
  const ok = verifyAuthority(authority, { action: 'payments.transfer', target: 'acct:9931', params: { amount: 1800 }, principal: 'user:test' });
  assert.equal(ok.allowed, true);

  // Same valid authority, changed amount: possession is not authority.
  const tampered = verifyAuthority(authority, { action: 'payments.transfer', target: 'acct:9931', params: { amount: 18000 }, principal: 'user:test' });
  assert.equal(tampered.allowed, false);
  assert.ok(tampered.failures.some((f) => f.code === 'PARAMETER_MISMATCH'));

  // Same authority, different target.
  const redirected = verifyAuthority(authority, { action: 'payments.transfer', target: 'acct:0001', params: { amount: 1800 }, principal: 'user:test' });
  assert.ok(redirected.failures.some((f) => f.code === 'TARGET_MISMATCH'));
});

test('authority expires and cannot be replayed', () => {
  const authority = issueAuthority({
    principal: 'user:test', action: 'payments.transfer', target: 'acct:1', params: { amount: 1 },
    consequence: 'MONEY_MOVED', validForSeconds: 60, issuedAt: '2026-01-01T00:00:00.000Z'
  });
  const execution = { action: 'payments.transfer', target: 'acct:1', params: { amount: 1 }, principal: 'user:test' };
  const expired = verifyAuthority(authority, execution, { now: '2026-01-01T00:05:00.000Z' });
  assert.ok(expired.failures.some((f) => f.code === 'AUTHORITY_EXPIRED'));

  const replayStore = createReplayStore();
  const at = '2026-01-01T00:00:30.000Z';
  assert.equal(verifyAuthority(authority, execution, { now: at, replayStore }).allowed, true);
  const second = verifyAuthority(authority, execution, { now: at, replayStore });
  assert.ok(second.failures.some((f) => f.code === 'REPLAYED_AUTHORITY'));
});

test('tampered authority fails its binding check', () => {
  const authority = issueAuthority({ principal: 'user:test', action: 'a', target: 't', params: {}, consequence: 'NONE' });
  const forged = { ...authority, action: 'payments.transfer' };
  const result = verifyAuthority(forged, { action: 'payments.transfer', target: 't', params: {}, principal: 'user:test' });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.some((f) => f.code === 'BINDING_HASH_MISMATCH'));
});

test('receipts are verifiable against the signing key and detect alteration', () => {
  const receipt = issueReceipt({
    request: { action: 'payments.transfer', target: 'acct:1', params: { amount: 1800 } },
    preview: previewConsequence(graph(), 'payments.transfer', { amount: 1800 }),
    route: resolveRoute(graph(), 'payments.transfer').selected,
    authority: issueAuthority({ principal: 'user:test', action: 'payments.transfer', target: 'acct:1', params: { amount: 1800 }, consequence: 'MONEY_MOVED' }),
    verification: { decision: 'EXECUTION_ALLOWED', failures: [] },
    result: { status: 'SUCCEEDED' }
  });
  assert.equal(verifyReceipt(receipt).valid, true);
  const altered = { ...receipt, requested: { ...receipt.requested, params: { amount: 18000 } } };
  assert.equal(verifyReceipt(altered).valid, false);
});

test('the full protected loop denies, then allows once approval is recorded', async () => {
  const g = graph();
  const request = { action: 'payments.transfer', target: 'acct:9931', params: { amount: 18000 } };

  const denied = await protect(g, request);
  assert.equal(denied.allowed, false);
  assert.ok(denied.receipt.verifier.failures.some((f) => f.code === 'APPROVAL_REQUIRED'));
  assert.equal(denied.receipt.executed, null);

  const allowed = await protect(g, request, { approval: { by: 'maurice' }, execute: () => 'transferred' });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.result.output, 'transferred');
  assert.equal(verifyReceipt(allowed.receipt).valid, true);
  assert.equal(allowed.receipt.authorityBound.materialParams.amount, 18000);
});

test('simulation runs the whole loop without causing an effect', async () => {
  let sideEffects = 0;
  const run = await simulate(graph(), { action: 'payments.transfer', target: 'acct:1', params: { amount: 100 } },
    { approval: { by: 'maurice' }, execute: () => { sideEffects++; } });
  assert.equal(sideEffects, 0);
  assert.equal(run.result.status, 'SIMULATED');
});

test('a receipt can never record an execution that was not allowed', () => {
  const receipt = issueReceipt({
    request: { action: 'payments.transfer', target: 'acct:1', params: {} },
    verification: { decision: 'EXECUTION_DENIED', failures: [{ code: 'APPROVAL_REQUIRED', message: 'no approval' }] },
    result: { status: 'SUCCEEDED' }
  });
  const result = verifyReceipt(receipt);
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((f) => f.code === 'EXECUTED_WITHOUT_AUTHORITY'));
});

test('receipt chains detect a removed or reordered receipt', () => {
  const make = (prior) => issueReceipt({
    request: { action: 'reports.read', target: 'r', params: {} },
    verification: { decision: 'EXECUTION_ALLOWED', failures: [] }, priorReceiptHash: prior
  });
  const first = make(null);
  const second = make(first.receiptHash);
  assert.equal(verifyReceiptChain([first, second]).valid, true);
  assert.equal(verifyReceiptChain([second, first]).valid, false);
});

test('the time machine explains why deterministically from recorded causes', async () => {
  const run = await protect(graph(), { action: 'payments.transfer', target: 'acct:1', params: { amount: 18000 } });
  const answer = why(run.timeline, 'EXECUTION_DENIED');
  assert.equal(answer.found, true);
  assert.match(answer.answer, /human approval/i);
  assert.ok(answer.because.some((b) => /MONEY_MOVED/.test(b)));
  assert.ok(replay(run.timeline).length > 3);
});

test('runs can be forked and compared to see where behaviour diverged', async () => {
  const request = { action: 'payments.transfer', target: 'acct:1', params: { amount: 18000 } };
  const denied = await protect(graph(), request, { timeline: createTimeline({ runId: 'a' }) });
  const allowed = await protect(graph(), request, { timeline: createTimeline({ runId: 'b' }), approval: { by: 'maurice' } });
  const diff = compare(denied.timeline, allowed.timeline);
  assert.equal(diff.sameOutcome, false);
  assert.ok(diff.divergedAt > 0);
  assert.equal(fork(denied.timeline, { upTo: 'e2' }).events.length, 3);
});

test('only canonical security events can enter a timeline', () => {
  const t = createTimeline();
  assert.throws(() => t.record('SOMETHING_FRAMEWORK_SPECIFIC', {}), /canonical/);
});

test('a receipt can be verified by someone who cannot mint one', () => {
  const issuer = generateKeyPair();
  const attacker = generateKeyPair();
  const issuerPublicKey = exportPublic(issuer.publicKey);

  const genuine = issueReceipt({
    request: { action: 'payments.transfer', target: 'acct:1', params: { amount: 1800 } },
    verification: { decision: 'EXECUTION_ALLOWED', failures: [] }, result: { status: 'SUCCEEDED' }, keyPair: issuer
  });
  const forged = issueReceipt({
    request: { action: 'payments.transfer', target: 'acct:attacker', params: { amount: 999999 } },
    verification: { decision: 'EXECUTION_ALLOWED', failures: [] }, result: { status: 'SUCCEEDED' }, keyPair: attacker
  });

  const checked = verifyReceipt(genuine, { publicKey: issuerPublicKey });
  assert.equal(checked.valid, true);
  assert.equal(checked.signerVerified, true);

  // The forgery is internally consistent, so it must be rejected on the signer.
  assert.equal(verifyReceipt(forged, { publicKey: issuerPublicKey }).valid, false);
  assert.ok(verifyReceipt(forged, { trustedKeyIds: [issuer.keyId] }).failures.some((f) => f.code === 'UNTRUSTED_SIGNER'));
});

test('verifying without pinning a signer is reported as unpinned, not as proof', () => {
  const receipt = issueReceipt({
    request: { action: 'reports.read', target: 'r', params: {} },
    verification: { decision: 'EXECUTION_ALLOWED', failures: [] }, keyPair: generateKeyPair()
  });
  const result = verifyReceipt(receipt);
  assert.equal(result.valid, true);
  assert.equal(result.signerVerified, false);
  assert.ok(result.warnings.some((w) => w.code === 'UNPINNED_KEY'));
});

test('a signature cannot be moved onto an authority signed by another key', () => {
  const issuer = generateKeyPair();
  const attacker = generateKeyPair();
  const authority = issueAuthority({ principal: 'user:test', action: 'payments.transfer', target: 'acct:1', params: { amount: 1 }, consequence: 'MONEY_MOVED', keyPair: issuer });
  const swapped = { ...authority, signerPublicKey: exportPublic(attacker.publicKey) };
  const execution = { action: 'payments.transfer', target: 'acct:1', params: { amount: 1 }, principal: 'user:test' };
  assert.equal(verifyAuthority(swapped, execution).allowed, false);
  assert.equal(verifyAuthority(authority, execution, { publicKey: exportPublic(issuer.publicKey) }).allowed, true);
});

test('material parameters change the consequence, and the consequence sets the trust bar', () => {
  const g = graph();
  const small = previewConsequence(g, 'payments.transfer', { amount: 1800 });
  const large = previewConsequence(g, 'payments.transfer', { amount: 18000 });
  assert.equal(small.severity, 'HIGH');
  assert.equal(large.severity, 'CRITICAL');
  assert.equal(resolveRoute(g, 'payments.transfer', { severity: small.severity }).trustRequired, 0.75);
  assert.equal(resolveRoute(g, 'payments.transfer', { severity: large.severity }).trustRequired, 0.9);
});
