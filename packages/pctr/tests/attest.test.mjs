import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { attestAgent, attestGraph, proveThreshold, scoreExecutionReceipt, behaviouralReceipts } from '../src/attest.mjs';
import { buildGraph } from '../src/graph.mjs';
import { resolveRoute } from '../src/router.mjs';
import { agentTrustNow } from '../src/trust.mjs';

const now = '2026-09-15T12:00:00.000Z';
const ago = (seconds) => new Date(new Date(now).getTime() - seconds * 1000).toISOString();

const receipt = (over = {}) => ({
  receiptId: `r-${Math.random().toString(36).slice(2, 8)}`,
  requested: { action: 'payments.transfer', target: 't', params: {} },
  routeSelected: { routeId: 'user:test -> agent -> payments -> payments.transfer', agents: ['agent'] },
  verifier: { decision: 'EXECUTION_ALLOWED', failures: [] },
  executed: { status: 'SUCCEEDED', executedAt: ago(10) },
  issuedAt: ago(10), ...over
});

const manifest = () => ({
  principal: 'user:test',
  agents: [{ id: 'agent', trust: 0.99, evidenceAgeSeconds: 5, authority: ['payments.*'], tools: ['payments'] }],
  tools: [{ id: 'payments', actions: ['payments.transfer'] }],
  actions: [{ id: 'payments.transfer', amount: 100 }],
  policy: {}
});

test('behaviour is scored on the scale the protocol defines', () => {
  // protocol/scoring-semantics.md 3.2 — tool_execution.
  assert.ok(scoreExecutionReceipt(receipt()) >= 0.90, 'clean execution is Excellent');
  assert.ok(scoreExecutionReceipt(receipt({ verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'INSUFFICIENT_AUTHORITY' }] } })) <= 0.29,
    'reaching for authority it lacks is Bad');
  assert.ok(scoreExecutionReceipt(receipt({ verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'REPLAYED_AUTHORITY' }] } })) <= 0.39,
    'replaying an authority is a policy violation');

  // Waiting on a human is not the agent misbehaving.
  const pending = scoreExecutionReceipt(receipt({ verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'APPROVAL_REQUIRED' }] } }));
  assert.ok(pending >= 0.60 && pending < 0.90, `approval pending should be Good-ish, got ${pending}`);
});

test('an agent with no evidence is unproven, never its declared score', async () => {
  const m = await attestAgent({ id: 'ghost', trust: 0.99 }, { receipts: [], at: now });
  assert.equal(m.proven, false);
  assert.equal(m.trust, null);
  assert.equal(m.declaredTrust, 0.99);
  assert.equal(m.reason, 'INSUFFICIENT_TRUST_DATA');
});

test('unproven trust is treated as zero by the trust check, not as the manifest value', () => {
  const state = agentTrustNow({ id: 'ghost', trust: 0.99 }, { severity: 'HIGH', measured: { proven: false } });
  assert.equal(state.trust, 0);
  assert.equal(state.provenance, 'unproven');
  assert.equal(state.evidenceStale, true);
});

test('a protected consequence will not route through unmeasured trust', () => {
  const graph = buildGraph(manifest());
  const result = resolveRoute(graph, 'payments.transfer', {
    measurements: { agent: { proven: false } }
  });
  assert.equal(result.selected, null);
  assert.ok(result.candidates.flatMap((c) => c.rejections).some((r) => r.code === 'TRUST_UNPROVEN'));
});

test('measured trust replaces the declared number when evidence exists', async () => {
  const receipts = Array.from({ length: 5 }, () => receipt());
  const m = await attestAgent({ id: 'agent', trust: 0.99 }, { receipts, at: now, severity: 'HIGH' });
  assert.equal(m.proven, true);
  assert.ok(m.trust > 0.9 && m.trust <= 1, `clean history should measure high, got ${m.trust}`);

  const state = agentTrustNow({ id: 'agent', trust: 0.99 }, { severity: 'HIGH', measured: m });
  assert.equal(state.provenance, 'measured');
  assert.equal(state.trust, m.trust);
});

test('misbehaviour drags measured trust below what the manifest claims', async () => {
  const receipts = [
    ...Array.from({ length: 4 }, () => receipt()),
    receipt({ verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'INSUFFICIENT_AUTHORITY' }] } })
  ];
  const m = await attestAgent({ id: 'agent', trust: 0.99 }, { receipts, at: now, severity: 'HIGH' });
  assert.ok(m.drift < -0.1, `expected the overstatement to show, drift was ${m.drift}`);
  assert.ok(m.trust < 0.99);
});

test('a failing attestor yields no evidence, never favourable evidence', async () => {
  const m = await attestAgent({ id: 'agent', trust: 0.99 }, {
    receipts: [], attestors: ['./nonexistent-attestor.mjs'], at: now
  });
  assert.equal(m.proven, false);
  assert.equal(m.errors.length, 1);
  assert.match(m.errors[0].error, /Cannot find|does not export/);
});

test('an external attestor contributes verified attestations only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pctr-attest-'));
  const file = path.join(dir, 'attestor.mjs');
  fs.writeFileSync(file, `
    export default async ({ agentId }) => ({ attestations: [
      { ref: 'att-good', subject: agentId, issuer: 'workload-identity', type: 'spiffe',
        score: 0.95, issuedAt: '${ago(5)}', expiresAt: '${ago(-3600)}', claims: {} },
      { ref: 'att-expired', subject: agentId, issuer: 'stale-issuer', type: 'spiffe',
        score: 1.0, issuedAt: '${ago(99999)}', expiresAt: '${ago(9999)}', claims: {} },
      { ref: 'att-wrong-subject', subject: 'someone-else', issuer: 'confused-issuer', type: 'spiffe',
        score: 1.0, issuedAt: '${ago(5)}', expiresAt: '${ago(-3600)}', claims: {} }
    ] });
  `);
  const m = await attestAgent({ id: 'agent', trust: 0.5 }, { receipts: [], attestors: [file], at: now, severity: 'HIGH', cwd: dir });

  assert.equal(m.proven, true);
  const valid = m.attestations.filter((a) => a.valid);
  assert.equal(valid.length, 1, 'only the fresh, correctly-subjected attestation counts');
  assert.equal(valid[0].attestationRef, 'att-good');
  assert.ok(m.attestations.some((a) => a.failureReasons.some((f) => f.code === 'EXPIRED_ATTESTATION')));
  assert.ok(m.attestations.some((a) => a.failureReasons.some((f) => f.code === 'INVALID_SUBJECT')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a threshold proof is a TTP artefact carrying its evidence', async () => {
  const m = await attestAgent({ id: 'agent', trust: 0.99 }, { receipts: Array.from({ length: 3 }, () => receipt()), at: now, severity: 'HIGH' });
  const proof = proveThreshold(m, 'HIGH', { at: now });
  assert.equal(proof.type, 'TrustThresholdProof');
  assert.equal(proof.subject, 'agent');
  assert.equal(proof.requiredThreshold, 0.75);
  assert.equal(proof.satisfied, true);
  assert.match(proof.proofHash, /^sha256:/);
  assert.ok(proof.evidenceRefs.length, 'the proof names what it rests on');

  // An unproven agent proves nothing.
  const unproven = proveThreshold(await attestAgent({ id: 'ghost' }, { receipts: [], at: now }), 'HIGH', { at: now });
  assert.equal(unproven.satisfied, false);
});

test('measuring a whole graph names the agents running on typed-in numbers', async () => {
  const graph = buildGraph({
    ...manifest(),
    agents: [
      { id: 'agent', trust: 0.99, authority: ['payments.*'], tools: ['payments'] },
      { id: 'ghost', trust: 0.99, authority: ['payments.*'], tools: ['payments'] }
    ]
  });
  const result = await attestGraph(graph, { receipts: Array.from({ length: 3 }, () => receipt()), at: now, severity: 'HIGH' });
  assert.deepEqual(result.unproven, ['ghost']);
  assert.equal(result.proven, 1);
});

test('behavioural receipts are attributed to the agents on the route', () => {
  const receipts = [receipt(), receipt({ routeSelected: { routeId: 'x', agents: ['other'] } })];
  assert.equal(behaviouralReceipts('agent', receipts).length, 1);
  assert.equal(behaviouralReceipts('other', receipts).length, 1);
  assert.equal(behaviouralReceipts('nobody', receipts).length, 0);
});
