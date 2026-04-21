import test from 'node:test'
import assert from 'node:assert/strict'
import { computeBindingHash, resolveTrustRoute, computeTrustScoreWithDecay, createExecutionReceipt, defaultRoutingPolicy } from '../src/index.js'

function request(overrides = {}) {
  const base = {
    subject: 'wl-123',
    action: 'build.run',
    resource: 'github:repo/job/build',
    context: { environment: 'ci' },
    attestationRef: 'att-1',
    requestedBy: 'github-actions',
    paramsHash: 'sha256:params',
    timestamp: '2026-04-19T12:00:00.000Z',
    delegationHopCount: 0
  }
  const bindingHash = computeBindingHash({ subject: base.subject, action: base.action, resource: base.resource, paramsHash: base.paramsHash, timestampBucket: base.timestamp.slice(0, 16) })
  return { ...base, bindingHash, ...overrides }
}

function candidate(overrides = {}) {
  return {
    issuerType: 'behavioral',
    issuerId: 'iss-1',
    proofRef: 'proof-1',
    trustScore: 0.92,
    lastVerifiedAt: '2026-04-19T11:59:00.000Z',
    freshnessSeconds: 60,
    revoked: false,
    delegationAllowed: true,
    maxHops: 2,
    currentHopCount: 0,
    grantId: 'grant-1',
    minTrustScore: 0.65,
    requiresStepUp: false,
    action: 'build.run',
    ...overrides
  }
}

test('trust decay decreases score over time', () => {
  const score = computeTrustScoreWithDecay({ baseScore: 0.9, decayConstant: 0.001, elapsedSeconds: 1000, weightedSignals: [] })
  assert.ok(score < 0.9)
})

test('route selection strongest path wins', () => {
  const r = resolveTrustRoute({ request: request(), candidates: [candidate({ issuerId: 'a', trustScore: 0.7 }), candidate({ issuerId: 'b', trustScore: 0.95 })] })
  assert.equal(r.decision, 'PERMIT')
  assert.equal(r.selectedPath, 'behavioral:b')
})

test('binding mismatch denies', () => {
  const r = resolveTrustRoute({ request: request({ bindingHash: 'sha256:bad' }), candidates: [candidate()] })
  assert.equal(r.decision, 'DENY')
  assert.deepEqual(r.reasonCodes, ['binding_mismatch'])
})

test('stale attestation denies route', () => {
  const r = resolveTrustRoute({ request: request(), candidates: [candidate({ freshnessSeconds: 2000 })] })
  assert.equal(r.decision, 'DENY')
})

test('revoked subject denies', () => {
  const r = resolveTrustRoute({ request: request(), candidates: [candidate({ revoked: true })] })
  assert.equal(r.decision, 'DENY')
  assert.deepEqual(r.reasonCodes, ['revoked_subject'])
})

test('hop count exceeded denies', () => {
  const r = resolveTrustRoute({ request: request({ delegationHopCount: 3 }), candidates: [candidate({ maxHops: 1 })] })
  assert.equal(r.decision, 'DENY')
})

test('require_all denies when one path invalid', () => {
  const p = { ...defaultRoutingPolicy, strategy: 'require_all' }
  const r = resolveTrustRoute({ request: request(), policy: p, candidates: [candidate(), candidate({ freshnessSeconds: 9999 })] })
  assert.equal(r.decision, 'DENY')
  assert.deepEqual(r.reasonCodes, ['require_all_not_satisfied'])
})

test('require_any permits when one path valid', () => {
  const p = { ...defaultRoutingPolicy, strategy: 'require_any' }
  const r = resolveTrustRoute({ request: request(), policy: p, candidates: [candidate({ freshnessSeconds: 9999 }), candidate()] })
  assert.equal(r.decision, 'PERMIT')
})

test('github action step permit integration shape', () => {
  const r = resolveTrustRoute({ request: request({ action: 'build.run' }), candidates: [candidate({ action: 'build.run' })] })
  assert.equal(r.decision, 'PERMIT')
  const receipt = createExecutionReceipt({ request: request(), decision: r })
  assert.ok(receipt.chainHash)
})

test('github action step deny integration shape', () => {
  const r = resolveTrustRoute({ request: request({ action: 'deploy.production' }), candidates: [candidate({ action: 'deploy.production', trustScore: 0.2, minTrustScore: 0.7 })] })
  assert.equal(r.decision, 'DENY')
})

test('receipt chain hash links to prior receipt', () => {
  const r = resolveTrustRoute({ request: request(), candidates: [candidate()] })
  const first = createExecutionReceipt({ request: request(), decision: r })
  const second = createExecutionReceipt({ request: request({ action: 'test.run', resource: 'github:repo/job/test' }), decision: r, priorReceiptHash: first.chainHash })
  assert.equal(second.priorReceiptHash, first.chainHash)
})

test('resolver outage fails closed deny', () => {
  const r = resolveTrustRoute({ request: request(), candidates: [candidate()], resolverAvailable: false })
  assert.equal(r.decision, 'DENY')
  assert.deepEqual(r.reasonCodes, ['resolver_unavailable'])
})

test('delegated route simulation agent -> agent -> tool -> API', () => {
  const req = request({ action: 'tool.invoke', resource: 'api:payments/refund', delegationHopCount: 2 })
  req.bindingHash = computeBindingHash({ subject: req.subject, action: req.action, resource: req.resource, paramsHash: req.paramsHash, timestampBucket: req.timestamp.slice(0, 16) })
  const r = resolveTrustRoute({
    request: req,
    candidates: [
      candidate({ issuerType: 'supervisor', issuerId: 'agent-parent', trustScore: 0.88, action: 'tool.invoke', maxHops: 3, delegationAllowed: true }),
      candidate({ issuerType: 'workload', issuerId: 'tool-runtime', trustScore: 0.81, action: 'tool.invoke', maxHops: 3, delegationAllowed: true })
    ],
    policy: { ...defaultRoutingPolicy, strategy: 'supervisor_override' }
  })
  assert.equal(r.selectedPath, 'supervisor:agent-parent')
})
