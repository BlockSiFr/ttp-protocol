import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'http://127.0.0.1:18080';
const CWD = fileURLToPath(new URL('.', import.meta.url));

async function waitForHealth(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until service is up
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('runtime-authority-gate did not become healthy in time');
}

test('runtime-authority-gate /healthz and /re/authorize contract', async () => {
  const server = spawn('node', ['server.mjs'], {
    cwd: CWD,
    env: { ...process.env, PORT: '18080' },
    stdio: 'pipe'
  });

  try {
    await waitForHealth();

    const health = await fetch(`${BASE_URL}/healthz`).then((r) => r.json());
    assert.equal(health.status, 'ok');

    const request = {
      requestId: 'test-req-1',
      principal: { id: 'agent-1', type: 'service-agent' },
      action: 'pipeline.deploy',
      resource: { type: 'environment', id: 'prod' },
      context: { trustScore: 0.85 },
      authorityGrant: {
        grantId: 'grant-local-001',
        expiresAt: '2030-01-01T00:00:00Z',
        scope: ['pipeline.deploy:prod']
      }
    };

    const result1 = await fetch(`${BASE_URL}/re/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request)
    }).then((r) => r.json());

    assert.equal(result1.decision, 'PERMIT');
    assert.equal(result1.mode, 'FULL');
    assert.ok(result1.receipt.receiptId);
    assert.ok(result1.receipt.integrity.hash);
    assert.equal(result1.receipt.integrity.chainHash, '');
    assert.equal(result1.receipt.schemaVersion, '1.0.0');
    assert.equal(result1.receipt.decision.outcome, 'PERMIT');

    const result2 = await fetch(`${BASE_URL}/re/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...request, requestId: 'test-req-2' })
    }).then((r) => r.json());

    assert.equal(result2.decision, 'PERMIT');
    assert.ok(result2.mode === 'FULL' || result2.mode === 'CONSTRAINED');
    assert.equal(result2.receipt.integrity.chainHash, result1.receipt.integrity.hash);

    const denied = await fetch(`${BASE_URL}/re/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...request,
        requestId: 'test-req-3',
        context: { trustScore: 0.1 }
      })
    }).then((r) => r.json());

    assert.equal(denied.decision, 'DENY');
    assert.equal(denied.mode, 'FAILED_CLOSED');
    assert.ok(denied.receipt.receiptId);
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
});
