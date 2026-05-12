import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const BASE_URL = 'http://127.0.0.1:18080';
const CWD = fileURLToPath(new URL('.', import.meta.url));

async function waitForHealth(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('runtime-authority-gate did not become healthy in time');
}

async function assertLocalListenAvailable(t) {
  const probe = net.createServer();
  let listening = false;
  try {
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(18080, '127.0.0.1', () => {
        listening = true;
        resolve();
      });
    });
  } catch (err) {
    if (err?.code === 'EPERM') {
      t.skip('local TCP listen is unavailable in this sandbox');
      return false;
    }
    throw err;
  } finally {
    if (listening) await new Promise((resolve) => probe.close(resolve));
  }
  return true;
}

test('runtime-authority-gate supports all decision branches and durable storage mode', async (t) => {
  if (!(await assertLocalListenAvailable(t))) return;

  const receiptFile = path.join(os.tmpdir(), `runtime-gate-${Date.now()}.json`);
  const server = spawn('node', ['server.mjs'], {
    cwd: CWD,
    env: {
      ...process.env,
      PORT: '18080',
      RECEIPT_STORE_MODE: 'file',
      RECEIPT_STORE_FILE: receiptFile,
      RECEIPT_SIGNING_MODE: 'HMAC',
      RECEIPT_HMAC_SECRET: 'test-secret'
    },
    stdio: 'pipe'
  });

  try {
    await waitForHealth();

    const health = await fetch(`${BASE_URL}/healthz`).then((r) => r.json());
    assert.equal(health.status, 'ok');
    assert.equal(health.storage.mode, 'file');
    assert.equal(health.signing.algorithm, 'HMAC-SHA256');

    const baseRequest = {
      requestId: 'req-permit',
      principal: { id: 'agent-1', type: 'service-agent' },
      action: 'pipeline.deploy',
      resource: { type: 'environment', id: 'prod' },
      context: { trustScore: 0.9, environment: 'dev' },
      authorityGrant: {
        grantId: 'grant-local-001',
        expiresAt: '2030-01-01T00:00:00Z',
        scope: ['pipeline.deploy:prod']
      }
    };

    const permit = await fetch(`${BASE_URL}/re/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(baseRequest)
    }).then((r) => r.json());
    assert.equal(permit.decision, 'PERMIT');
    assert.equal(permit.mode, 'FULL');
    assert.equal(permit.rapDecision, 'allow');
    assert.equal(permit.receipt.integrity.signatureStatus, 'SIGNED');

    const stepUp = await fetch(`${BASE_URL}/re/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseRequest, requestId: 'req-step-up', context: { trustScore: 0.55, environment: 'dev' } })
    }).then((r) => r.json());
    assert.equal(stepUp.decision, 'STEP_UP');
    assert.equal(stepUp.rapDecision, 'step_up');

    const escalate = await fetch(`${BASE_URL}/re/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...baseRequest,
        requestId: 'req-escalate',
        action: 'tool.invoke.delete_secret',
        context: { trustScore: 0.95, environment: 'prod', agentType: 'mythos' }
      })
    }).then((r) => r.json());
    assert.equal(escalate.decision, 'ESCALATE');
    assert.equal(escalate.rapDecision, 'escalate');

    const deny = await fetch(`${BASE_URL}/re/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseRequest, requestId: 'req-deny', context: { trustScore: 0.1, environment: 'dev' } })
    }).then((r) => r.json());
    assert.equal(deny.decision, 'DENY');
    assert.equal(deny.rapDecision, 'deny');

    const reauth = await fetch(`${BASE_URL}/re/reauthorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'req-reauth',
        priorReceiptId: stepUp.receiptId,
        approval: { approvedBy: 'ops-admin', evidenceRef: 'ticket-123' }
      })
    }).then((r) => r.json());
    assert.equal(reauth.decision, 'PERMIT');
    assert.equal(reauth.mode, 'CONSTRAINED');

    const list = await fetch(`${BASE_URL}/receipts`).then((r) => r.json());
    assert.ok(list.count >= 5);

    const persisted = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    assert.ok(Array.isArray(persisted));
    assert.ok(persisted.length >= 5);
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
    if (fs.existsSync(receiptFile)) fs.unlinkSync(receiptFile);
  }
});
