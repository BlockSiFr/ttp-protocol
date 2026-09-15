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

// Three vectors do not agree with the algorithm the specification actually defines.
// They are asserted as known divergences rather than skipped, so the discrepancy is
// visible in the test output and cannot be quietly forgotten. See the README section
// "Known divergences in the aggregation vectors".
const KNOWN_DIVERGENT = {
  'agg-003': {
    yields: 0.5,
    why: 'Superseded by agg-003-corrected, which has identical receipts and expects 0.5. ' +
         "This vector's own _explanation field works the arithmetic, catches itself mid-sentence " +
         '("wait let me recalculate") and concludes 0.5, while its expected field still says 0.4.'
  },
  'agg-006': {
    yields: 0.5799,
    why: 'The expected 0.5 requires both issuers capped at 0.40. B\'s uncapped fraction is 0.29, ' +
         'and step 5 says min(fraction, max_issuer_weight) — a cap, not a floor. The stated intent ' +
         '(4 good receipts from A cannot dominate 1 bad from B) is not what the written formula does.'
  },
  'agg-008': {
    yields: 0.918,
    why: 'Off by 0.0010, a hair outside the vectors\' own +/-0.001 tolerance. Consistent with the ' +
         'expected value having been computed from rounded intermediate weights.'
  }
};

for (const testCase of vectors.cases) {
  const divergence = KNOWN_DIVERGENT[testCase.id];
  if (divergence) {
    test(`known divergence ${testCase.id}: vector expects ${testCase.expected.score}, spec formula yields ${divergence.yields}`, () => {
      const result = aggregateTrust(testCase.receipts, testCase.current_time_ms, vectors.params);
      assert.ok(Math.abs(result.score - divergence.yields) <= 0.001,
        `the implementation must follow the written algorithm: ${divergence.why}`);
      assert.ok(Math.abs(result.score - testCase.expected.score) > 0.001,
        `${testCase.id} now agrees with the vector — delete this entry from KNOWN_DIVERGENT`);
    });
    continue;
  }
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

test('capping binds, but re-normalization gives most of it back', () => {
  // Worth stating plainly, because the cap does not do what its name suggests. Step 5
  // caps a dominant issuer at 0.40 and then re-normalizes across issuers — so when the
  // other issuers carry little weight, the capped issuer still ends up with most of the
  // vote. The cap only bites when the rest of the field is comparable in weight.
  const now = 1_700_000_000_000;
  const receipts = [
    ...Array.from({ length: 50 }, (_, i) => ({ receipt_id: `loud${i}`, issuer_id: 'LOUD', score: 1.0, timestamp: now })),
    { receipt_id: 'q1', issuer_id: 'B', score: 0.2, timestamp: now },
    { receipt_id: 'q2', issuer_id: 'C', score: 0.2, timestamp: now }
  ];
  const result = aggregateTrust(receipts, now);
  const loud = result.issuers.find((i) => i.issuer_id === 'LOUD');
  assert.equal(loud.capped, true, 'the dominant issuer is capped');
  assert.ok(loud.weight > 0.8,
    `re-normalization returns most of the capped weight: LOUD still holds ${loud.weight}`);
  assert.ok(result.score > 0.85, 'so 50 perfect receipts from one issuer do outvote two bad ones');
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
