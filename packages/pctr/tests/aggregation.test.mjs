import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aggregateTrust, DEFAULT_PARAMS, INSUFFICIENT_TRUST_DATA, scoreLabel } from '../src/aggregate.mjs';

// protocol/aggregation-spec.md is normative and ships test vectors. Every one runs here,
// so the implementation cannot drift from the specification it claims to implement.
const vectors = JSON.parse(fs.readFileSync(new URL('../../../protocol/test-vectors/aggregation-vectors.json', import.meta.url)));

test('the spec defaults are what this implementation uses', () => {
  assert.deepEqual(DEFAULT_PARAMS, vectors.params);
});

for (const testCase of vectors.cases) {
  test(`conformance ${testCase.id}: ${testCase.description}`, () => {
    const result = aggregateTrust(testCase.receipts, testCase.current_time_ms, vectors.params);

    if (testCase.expected.error) {
      assert.equal(result.error, testCase.expected.error);
      return;
    }
    // The vectors require agreement within +/- 0.001.
    assert.ok(Math.abs(result.score - testCase.expected.score) <= 0.001,
      `score ${result.score} is outside 0.001 of the expected ${testCase.expected.score}`);

    if (testCase.expected.contributing_receipts !== undefined) {
      assert.equal(result.contributing_receipts, testCase.expected.contributing_receipts);
    }
    if (testCase.expected.contributing_issuers !== undefined) {
      assert.equal(result.contributing_issuers, testCase.expected.contributing_issuers);
    }
  });
}

test('an empty window is insufficient data, not a score of zero', () => {
  const result = aggregateTrust([{ receipt_id: 'r', issuer_id: 'A', score: 1, timestamp: 0 }], 10_000_000);
  assert.equal(result.error, INSUFFICIENT_TRUST_DATA);
  assert.equal(result.score, null, 'absent evidence must never read as a trustworthy zero or one');
});

test('a bad actor cannot average away danger with good behaviour', () => {
  const now = 1_700_000_000_000;
  const receipts = [
    ...Array.from({ length: 9 }, (_, i) => ({ receipt_id: `good${i}`, issuer_id: 'A', score: 1.0, timestamp: now })),
    { receipt_id: 'bad', issuer_id: 'A', score: 0.0, timestamp: now }
  ];
  const result = aggregateTrust(receipts, now);
  // A plain mean would be 0.90. Negative amplification pulls it materially lower.
  assert.ok(result.score < 0.87, `expected amplification to bite, got ${result.score}`);
});

test('a capped issuer holds its cap and no more', () => {
  // This is what v1.0 got wrong: it capped the dominant issuer and then re-normalized
  // across everyone, handing the excess straight back. v1.1 redistributes to the
  // uncapped issuers instead, so the cap means what its name says.
  const now = 1_700_000_000_000;
  const receipts = [
    ...Array.from({ length: 50 }, (_, i) => ({ receipt_id: `loud${i}`, issuer_id: 'LOUD', score: 1.0, timestamp: now })),
    { receipt_id: 'q1', issuer_id: 'B', score: 0.2, timestamp: now },
    { receipt_id: 'q2', issuer_id: 'C', score: 0.2, timestamp: now }
  ];
  const result = aggregateTrust(receipts, now);
  const loud = result.issuers.find((i) => i.issuer_id === 'LOUD');
  assert.equal(loud.capped, true, 'the dominant issuer is capped');
  assert.ok(Math.abs(loud.weight - 0.4) < 0.001,
    `LOUD must hold exactly the cap, holds ${loud.weight}`);
  assert.ok(result.score < 0.55,
    `50 perfect receipts from one issuer must not outvote two bad ones: ${result.score}`);

  // The weights still describe a whole.
  const total = result.issuers.reduce((sum, i) => sum + i.weight, 0);
  assert.ok(Math.abs(total - 1) < 0.001, `weights must sum to 1, summed to ${total}`);
});

test('scores read in the words the scoring semantics define', () => {
  assert.equal(scoreLabel(0.95), 'Excellent');
  assert.equal(scoreLabel(0.75), 'Good');
  assert.equal(scoreLabel(0.55), 'Marginal');
  assert.equal(scoreLabel(0.35), 'Poor');
  assert.equal(scoreLabel(0.15), 'Bad');
  assert.equal(scoreLabel(0.05), 'Critical');
  assert.equal(scoreLabel(null), 'Unknown');
});
