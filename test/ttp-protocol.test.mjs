import test from 'node:test';
import assert from 'node:assert/strict';
import { verify_attestation } from '../src/attestation.mjs';
import { apply_decay } from '../src/decay.mjs';

test('verify_attestation accepts current matching attestation', () => {
  const result = verify_attestation({
    subject: 'agent:demo',
    validAt: '2026-01-01T00:00:00.000Z',
    attestation: {
      subject: 'agent:demo',
      issuer: 'runtime-authority',
      issuedAt: '2025-12-31T23:00:00.000Z',
      expiresAt: '2026-12-31T00:00:00.000Z',
      claims: {},
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.failureReasons, []);
});

test('verify_attestation rejects subject mismatch and expiry', () => {
  const result = verify_attestation({
    subject: 'agent:demo',
    validAt: '2026-01-01T00:00:00.000Z',
    attestation: {
      subject: 'agent:other',
      issuer: 'runtime-authority',
      issuedAt: '2025-12-31T23:00:00.000Z',
      expiresAt: '2025-12-31T23:59:00.000Z',
    },
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.failureReasons.map((failure) => failure.code), ['subject_mismatch', 'attestation_expired']);
});

test('apply_decay returns bounded trust with verified signal boost', () => {
  const result = apply_decay({
    initialTrust: 0.8,
    decayConstant: 0.001,
    elapsedSeconds: 10,
    activitySignals: [{ weight: 0.1, recencyFactor: 1, verified: true }],
    riskTier: 'low',
    calculatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(result.initialTrust, 0.8);
  assert.ok(result.finalTrust > result.decayedTrust);
  assert.ok(result.finalTrust <= 1);
});
