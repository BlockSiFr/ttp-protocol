import test from 'node:test';
import assert from 'node:assert/strict';
import {
  respondToChange, reconcile, RESPONSES, isMoreRestrictive, PROCEEDS,
  postureFor, withinPosture, CHAIN_CONTINUITY, LATENT_DEFECTS
} from '../src/decisions.mjs';

const preview = (over = {}) => ({ severity: 'HIGH', recordsAffected: 10, financialExposure: 100, ...over });
const route = (over = {}) => ({ routeId: 'r1', agents: ['a'], trustStates: [{ agentId: 'a', evidenceStale: false }], ...over });

test('the vocabulary is the nine the doctrine specifies, ordered by restrictiveness', () => {
  assert.deepEqual(RESPONSES, ['KEEP', 'REROUTE', 'CONSTRAIN', 'STEP_UP', 'ESCALATE', 'THROTTLE', 'SUSPEND', 'DENY', 'REVOKE']);
  assert.ok(isMoreRestrictive('DENY', 'REROUTE'));
  assert.ok(!isMoreRestrictive('KEEP', 'SUSPEND'));
  // Only some responses let the execution continue at all.
  assert.deepEqual(RESPONSES.filter((r) => PROCEEDS[r]), ['KEEP', 'REROUTE', 'CONSTRAIN', 'THROTTLE']);
});

test('a revoked credential outranks every softer answer', () => {
  const d = respondToChange({
    action: 'payments.transfer', preview: preview(), currentRoute: route(),
    agents: [{ id: 'a', revoked: true }], policy: {}
  });
  assert.equal(d.response, 'REVOKE');
  assert.equal(d.proceeds, false);
  assert.match(d.reason, /revoked/);
});

test('a quarantined agent suspends rather than reroutes around itself', () => {
  const d = respondToChange({ action: 'x', preview: preview(), currentRoute: route(), agents: [{ id: 'a', quarantined: true }] });
  assert.equal(d.response, 'SUSPEND');
});

test('consecutive failures suspend at the policy limit', () => {
  const d = respondToChange({ action: 'x', preview: preview(), currentRoute: route(), agents: [], policy: { suspendAfterFailures: 3 }, history: { consecutiveFailures: 3 } });
  assert.equal(d.response, 'SUSPEND');
  assert.match(d.reason, /3 consecutive failures/);
});

test('no route and no possible bound is a denial; a possible bound is not', () => {
  const denied = respondToChange({ action: 'x', preview: preview({ recordsAffected: 5 }), currentRoute: null, policy: {} });
  assert.equal(denied.response, 'DENY');

  // The same missing route, but the action is only too big — that is a constraint.
  const constrained = respondToChange({ action: 'x', preview: preview({ recordsAffected: 4000 }), currentRoute: null, policy: { batchLimit: 25 } });
  assert.equal(constrained.response, 'CONSTRAIN');
  assert.deepEqual(constrained.detail.constraint.max, { recordsAffected: 25 });
});

test('velocity is a consequence: too many in the window throttles', () => {
  const d = respondToChange({
    action: 'x', preview: preview(), currentRoute: route(), agents: [],
    policy: { maxPerWindow: { HIGH: 3 } }, history: { inWindow: 3 }
  });
  assert.equal(d.response, 'THROTTLE');
  assert.equal(d.proceeds, true, 'throttling slows an action down; it does not forbid it');
});

test('beyond the principal\'s authority escalates; stale evidence steps up', () => {
  const escalated = respondToChange({
    action: 'x', preview: preview({ severity: 'CRITICAL' }), currentRoute: route(), agents: [],
    policy: { escalateAtOrAbove: 'CRITICAL', escalateTo: 'security-oncall' }
  });
  assert.equal(escalated.response, 'ESCALATE');
  assert.match(escalated.reason, /security-oncall/);

  const steppedUp = respondToChange({
    action: 'x', preview: preview(), agents: [], policy: {},
    currentRoute: route({ trustStates: [{ agentId: 'a', evidenceStale: true, evidenceAgeSeconds: 4200, maxEvidenceAgeSeconds: 900 }] })
  });
  assert.equal(steppedUp.response, 'STEP_UP');
  assert.match(steppedUp.reason, /re-attest/);
});

test('a changed route that is still admissible reroutes, and an unchanged one keeps', () => {
  const rerouted = respondToChange({
    action: 'x', preview: preview({ recordsAffected: 1 }), agents: [], policy: {},
    previousRoute: { routeId: 'old' }, currentRoute: route({ routeId: 'new' })
  });
  assert.equal(rerouted.response, 'REROUTE');
  assert.equal(rerouted.detail.from, 'old');

  const kept = respondToChange({
    action: 'x', preview: preview({ recordsAffected: 1 }), agents: [], policy: {},
    previousRoute: { routeId: 'r1' }, currentRoute: route()
  });
  assert.equal(kept.response, 'KEEP');
});

test('reconcile refuses to answer a change with a weaker response than it warranted', () => {
  const strong = { response: 'SUSPEND', reason: 'agent quarantined' };
  const weak = { response: 'REROUTE', reason: 'another path exists' };
  const result = reconcile(strong, weak);
  assert.equal(result.response, 'SUSPEND');
  assert.equal(result.refusedWeaker, 'REROUTE');

  // A stronger response is allowed to win.
  assert.equal(reconcile(weak, strong).response, 'SUSPEND');
});

test('every TTP trust classification maps to a permitted downstream posture', () => {
  // SPECIFICATION.md, Trust Classification. Chain trust is graded, not binary.
  const expected = {
    TRUST_ACCEPTED: true, TRUST_ACCEPTED_WITH_CONTROLS: true,
    TRUST_REVIEW_RECOMMENDED: false, TRUST_CONTRADICTED: false,
    TRUST_DEFECTIVE: false, TRUST_REJECTED: false, TRUST_UNKNOWN: false
  };
  for (const [classification, proceeds] of Object.entries(expected)) {
    const posture = postureFor(classification);
    assert.equal(posture.proceeds, proceeds, classification);
    for (const response of posture.allowed) assert.ok(RESPONSES.includes(response), `${response} is a real response`);
  }
});

test('an unevaluated chain is not a trustworthy chain', () => {
  // TRUST_UNKNOWN must not be a neutral result, and an unrecognised classification
  // must be treated as unknown rather than waved through.
  assert.deepEqual(postureFor('TRUST_UNKNOWN').allowed, ['DENY', 'ESCALATE']);
  assert.equal(postureFor('something-nobody-defined').proceeds, false);
});

test('a response may not step outside the posture its classification permits', () => {
  assert.equal(withinPosture('KEEP', 'TRUST_ACCEPTED'), true);
  assert.equal(withinPosture('CONSTRAIN', 'TRUST_ACCEPTED_WITH_CONTROLS'), true);
  // Answering a rejected chain with a reroute is how a graded protocol turns into a
  // boolean one that always says yes.
  assert.equal(withinPosture('REROUTE', 'TRUST_REJECTED'), false);
  assert.equal(withinPosture('KEEP', 'TRUST_UNKNOWN'), false);
});

test('the chain-continuity and latent-defect vocabularies match the specification', () => {
  assert.equal(CHAIN_CONTINUITY.length, 7);
  assert.ok(CHAIN_CONTINUITY.includes('CHAIN_MISSING_LINK'));
  assert.equal(LATENT_DEFECTS.length, 11);
  assert.ok(LATENT_DEFECTS.includes('approval_bypass'));
  assert.ok(LATENT_DEFECTS.includes('prompt_injection_suspected'));
});
