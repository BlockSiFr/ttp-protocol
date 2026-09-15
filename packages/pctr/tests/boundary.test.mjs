import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildGraph } from '../src/graph.mjs';
import { protect } from '../src/protect.mjs';
import { issueAuthority } from '../src/authority.mjs';
import { startBoundaryServer, remoteBoundary, createBoundary, persistentReplayStore } from '../src/boundary.mjs';
import { generateKeyPair, exportPublic } from '../src/keys.mjs';
import { verifyReceipt } from '../src/receipt.mjs';

const graph = () => buildGraph({
  principal: 'user:test',
  agents: [{ id: 'finance', trust: 0.99, evidenceAgeSeconds: 5, authority: ['payments.*'], tools: ['payments'] }],
  tools: [{ id: 'payments', actions: ['payments.transfer'] }],
  actions: [{ id: 'payments.transfer', amount: 100 }],
  policy: { requireApprovalAtOrAbove: 'CRITICAL' }
});

test('authority is verified out of process, by a boundary the agent does not control', async () => {
  const { url, close } = await startBoundaryServer({ port: 0 });
  try {
    const run = await protect(graph(), { action: 'payments.transfer', target: 'acct:1', params: { amount: 100 } },
      { boundary: remoteBoundary(url), execute: () => 'sent' });
    assert.equal(run.allowed, true);
    assert.equal(run.receipt.verifier.boundary, url);
    assert.equal(run.result.output, 'sent');
  } finally {
    await close();
  }
});

test('an unreachable boundary denies execution; it never fails open', async () => {
  const { url, close } = await startBoundaryServer({ port: 0 });
  await close(); // the boundary is now gone
  const run = await protect(graph(), { action: 'payments.transfer', target: 'acct:1', params: { amount: 100 } },
    { boundary: remoteBoundary(url, { timeoutMs: 500 }), execute: () => 'sent' });
  assert.equal(run.allowed, false);
  assert.ok(run.receipt.verifier.failures.some((f) => f.code === 'BOUNDARY_UNREACHABLE'));
  assert.equal(run.result, null); // nothing executed
});

test('the boundary rejects an authority signed by a key it does not trust', async () => {
  const trusted = generateKeyPair();
  const attacker = generateKeyPair();
  const { url, close } = await startBoundaryServer({ port: 0, boundary: createBoundary({ trustedKeyIds: [trusted.keyId] }) });
  try {
    const forged = issueAuthority({ principal: 'user:test', action: 'payments.transfer', target: 'acct:attacker', params: { amount: 999999 }, consequence: 'MONEY_MOVED', keyPair: attacker });
    const boundary = remoteBoundary(url);
    const decision = await boundary.verify(forged, { action: 'payments.transfer', target: 'acct:attacker', params: { amount: 999999 }, principal: 'user:test' });
    assert.equal(decision.allowed, false);
    assert.ok(decision.failures.some((f) => f.code === 'UNTRUSTED_SIGNER'));
  } finally {
    await close();
  }
});

test('replay protection survives a boundary restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pctr-boundary-'));
  const file = path.join(dir, 'spent-nonces.json');
  const key = generateKeyPair();
  const publicKey = exportPublic(key.publicKey);
  const authority = issueAuthority({ principal: 'user:test', action: 'payments.transfer', target: 'acct:1', params: { amount: 100 }, consequence: 'MONEY_MOVED', keyPair: key });
  const execution = { action: 'payments.transfer', target: 'acct:1', params: { amount: 100 }, principal: 'user:test' };

  const first = createBoundary({ publicKey, replayStore: persistentReplayStore(file) });
  assert.equal(first.verify(authority, execution).allowed, true);

  // A fresh process, reading the same spent-nonce state.
  const restarted = createBoundary({ publicKey, replayStore: persistentReplayStore(file) });
  const second = restarted.verify(authority, execution);
  assert.equal(second.allowed, false);
  assert.ok(second.failures.some((f) => f.code === 'REPLAYED_AUTHORITY'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the protected loop signs with the key it was given, end to end', async () => {
  const key = generateKeyPair();
  const other = generateKeyPair();
  const run = await protect(graph(), { action: 'payments.transfer', target: 'acct:1', params: { amount: 100 } },
    { keyPair: key, publicKey: exportPublic(key.publicKey), execute: () => 'sent' });

  assert.equal(run.allowed, true);
  assert.equal(run.authority.keyId, key.keyId);
  assert.equal(verifyReceipt(run.receipt, { publicKey: exportPublic(key.publicKey) }).valid, true);
  assert.equal(verifyReceipt(run.receipt, { publicKey: exportPublic(other.publicKey) }).valid, false);
});
