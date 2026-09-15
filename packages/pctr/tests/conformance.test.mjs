import test from 'node:test';
import assert from 'node:assert/strict';

// PCTR vendors the TTP primitives so that installing it pulls in nothing else. That is
// only safe while the two implementations agree exactly, so compare them here against
// the reference implementation in this repo. If this fails, PCTR has drifted from TTP.
import * as vendored from '../src/ttp.mjs';
import { apply_decay as referenceDecay } from '../../../src/decay.mjs';
import { verify_trust_route as referenceRoute } from '../../../src/trust_route.mjs';
import { hashObj as referenceHash, canonicalize as referenceCanonicalize } from '../../../src/util.mjs';

test('canonicalization and hashing match the TTP reference exactly', () => {
  const samples = [
    { b: 1, a: 2 },
    { nested: { z: [3, 2, 1], a: 'x' }, n: 0.1234567 },
    { list: [{ b: true, a: null }, 'text', 42] },
    { unicode: 'héllo → ✓', empty: {}, arr: [] },
    { big: 1e21, small: 0.0000001, negative: -12.5 }
  ];
  for (const sample of samples) {
    assert.equal(vendored.canonicalize(sample), referenceCanonicalize(sample));
    assert.equal(vendored.hashObj(sample), referenceHash(sample));
  }
});

test('trust decay matches the TTP reference across risk tiers and signals', () => {
  const cases = [];
  for (const riskTier of ['low', 'medium', 'high']) {
    for (const elapsedSeconds of [0, 30, 900, 4200, 99999]) {
      for (const initialTrust of [0, 0.5, 0.97, 1]) {
        cases.push({ initialTrust, decayConstant: 0.00005, elapsedSeconds, riskTier, calculatedAt: '2026-01-01T00:00:00.000Z' });
      }
    }
  }
  cases.push({
    initialTrust: 0.4, decayConstant: 0.0001, elapsedSeconds: 600, riskTier: 'medium',
    activitySignals: [{ verified: true, weight: 0.2, recencyFactor: 0.5 }, { verified: false, weight: 0.9 }],
    calculatedAt: '2026-01-01T00:00:00.000Z'
  });
  for (const input of cases) {
    assert.deepEqual(vendored.apply_decay(input), referenceDecay(input), JSON.stringify(input));
  }
});

test('trust route verification matches the TTP reference, including failure codes', () => {
  const base = {
    routeId: 'r1', maxHops: 6, decayPerHop: 0.05, minIntermediateTrust: 0.1,
    sourceDomain: 'local', targetDomain: 'local', action: 'payments.transfer', resource: 'acct:1'
  };
  const cases = [
    { ...base, hops: [{ subject: 'a', issuer: 'i', trustScore: 0.9 }] },
    { ...base, hops: [{ subject: 'a', issuer: 'i', trustScore: 0.9 }, { subject: 'b', issuer: 'i', trustScore: 0.8 }] },
    { ...base, hops: [] },
    { ...base, hops: [{ subject: '', issuer: 'i', trustScore: 0.9 }] },
    { ...base, hops: Array.from({ length: 9 }, (_, i) => ({ subject: `a${i}`, issuer: 'i', trustScore: 0.99 })) },
    { ...base, hops: [{ subject: 'a', issuer: 'rogue', trustScore: 0.9 }], routePolicy: { trustedIssuers: ['i'] } },
    { ...base, hops: [{ subject: 'a', issuer: 'i', trustScore: 0.9 }], routePolicy: { allowedActions: ['reports.read'] } },
    { ...base, hops: [{ subject: 'a', issuer: 'i', trustScore: 0.9 }], routePolicy: { allowedDomains: ['eu->us'], refs: ['policy-7'] } },
    { ...base, hops: [{ subject: 'a', issuer: 'i', trustScore: 0.2 }], minIntermediateTrust: 0.5 }
  ];
  for (const input of cases) {
    assert.deepEqual(vendored.verify_trust_route(input), referenceRoute(input), JSON.stringify(input.hops));
  }
});
