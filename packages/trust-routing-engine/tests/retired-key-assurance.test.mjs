import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto'
import { assessRetiredKeyCoverage, canonicalObservation } from '../src/retired-key-assurance.js'
import { resolveTrustRoute, computeBindingHash } from '../src/resolve.js'

// Synthetic protocol-level payloads, not SAML XML signatures or a live SP.
// An SP's decision is established by verifying real RSA signatures against the
// public key(s) the controlled test-SP is configured to trust.
const key1 = generateKeyPairSync('rsa', { modulusLength: 2048 })
const key2 = generateKeyPairSync('rsa', { modulusLength: 2048 })
const observer = generateKeyPairSync('ed25519')
const publicKeyPEM = observer.publicKey.export({ type: 'spki', format: 'pem' })
const fingerprint = createHash('sha256').update(key1.publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
const issuerId = 'synthetic-idp-1'
const runId = 'cfav-issue-90-local-fixture'
const assessedAt = '2026-11-11T15:00:00.000Z'
const scopes = { issuerId, keyFingerprint: fingerprint, runId,
  relyingPartyIds: ['SP-A-DYNAMIC', 'SP-B-PINNED', 'SP-C-UNKNOWN'],
  pinnedObserverKeys: { 'staging-observer-1': publicKeyPEM }, assessedAt }

function assertion(privateKey, audience) {
  const payload = { issuerId, audience, subject: 'synthetic-user',
    issuedAt: '2026-11-11T14:59:00.000Z', expiresAt: '2026-11-11T15:04:00.000Z', nonce: 'synthetic-unique-1' }
  const bytes = Buffer.from(JSON.stringify(payload))
  return { payload, bytes, signature: sign('RSA-SHA256', bytes, privateKey) }
}
function targetAccepts(signed, audience, trustedPublicKeys) {
  if (signed.payload.issuerId !== issuerId || signed.payload.audience !== audience) return false
  if (Date.parse(signed.payload.expiresAt) <= Date.parse(assessedAt)) return false
  return trustedPublicKeys.some(key => verify('RSA-SHA256', signed.bytes, key, signed.signature))
}
function observed(relyingPartyId, kind, outcome, challengeId) {
  const o = { runId, observerId: 'staging-observer-1', issuerId, relyingPartyId,
    keyFingerprint: fingerprint, challengeId, kind, outcome, observedAt: assessedAt }
  return { ...o, signature: sign(null, canonicalObservation(o), observer.privateKey).toString('base64') }
}
function evaluate(observations) {
  return assessRetiredKeyCoverage({ ...scopes, observations })
}
function protectedRouteDecision() {
  const request = { subject: 'synthetic-user', action: 'record.write', resource: 'sp-b:protected-record',
    paramsHash: 'sha256:synthetic', timestamp: assessedAt, context: {}, delegationHopCount: 0 }
  request.bindingHash = computeBindingHash({ subject: request.subject, action: request.action,
    resource: request.resource, paramsHash: request.paramsHash, timestampBucket: assessedAt.slice(0, 16) })
  return resolveTrustRoute({ request, candidates: [{ issuerType: 'workload', issuerId,
    proofRef: 'synthetic-proof', trustScore: 0.99, lastVerifiedAt: assessedAt,
    freshnessSeconds: 0, revoked: true, action: 'record.write',
    delegationAllowed: false, maxHops: 0, grantId: 'synthetic-grant', minTrustScore: 0.65 }] })
}

test('real RSA signatures: dynamic SP rejects retired K1, pinned SP accepts K1', () => {
  const oldForA = assertion(key1.privateKey, 'SP-A-DYNAMIC')
  const newForA = assertion(key2.privateKey, 'SP-A-DYNAMIC')
  const oldForB = assertion(key1.privateKey, 'SP-B-PINNED')
  assert.equal(targetAccepts(oldForA, 'SP-A-DYNAMIC', [key2.publicKey]), false)
  assert.equal(targetAccepts(newForA, 'SP-A-DYNAMIC', [key2.publicKey]), true)
  assert.equal(targetAccepts(oldForB, 'SP-B-PINNED', [key1.publicKey]), true)
  assert.equal(targetAccepts(oldForB, 'SP-A-DYNAMIC', [key1.publicKey]), false)
})

test('retired key is denied for protected effect despite pinned SP accepting it', () => {
  const oldForB = assertion(key1.privateKey, 'SP-B-PINNED')
  assert.equal(targetAccepts(oldForB, 'SP-B-PINNED', [key1.publicKey]), true)
  const d = protectedRouteDecision()
  assert.equal(d.decision, 'DENY')
  assert.deepEqual(d.reasonCodes, ['revoked_subject'])
  let protectedEffectOccurred = false
  if (d.decision === 'PERMIT') protectedEffectOccurred = true
  assert.equal(protectedEffectOccurred, false)
  const report = evaluate([
    observed('SP-A-DYNAMIC', 'native_assertion', 'REJECTED', 'A3'),
    observed('SP-B-PINNED', 'native_assertion', 'ACCEPTED', 'A4'),
    observed('SP-B-PINNED', 'protected_effect', 'BLOCKED', 'A4')
  ])
  assert.equal(report.allKnownPartiesNativeReject, false)
  assert.equal(report.allKnownPartiesEffectConstrained, false) // SP-C still unknown
  assert.equal(report.edges[0].verdict, 'NATIVE_REJECTED')
  assert.equal(report.edges[1].verdict, 'RESIDUAL_TRUST_BLOCKED_AT_EFFECT')
  assert.equal(report.edges[2].verdict, 'UNKNOWN')
})

test('a blocked effect from an unrelated challenge cannot establish protection', () => {
  const report = evaluate([
    observed('SP-B-PINNED', 'native_assertion', 'ACCEPTED', 'A4'),
    observed('SP-B-PINNED', 'protected_effect', 'BLOCKED', 'different-challenge')
  ])
  assert.equal(report.edges[1].verdict, 'NATIVE_ACCEPTANCE_UNCONTROLLED')
})

test('accepted native assertion without observed downstream block is uncontrolled', () => {
  const report = evaluate([observed('SP-B-PINNED', 'native_assertion', 'ACCEPTED', 'A4')])
  assert.equal(report.edges[1].verdict, 'NATIVE_ACCEPTANCE_UNCONTROLLED')
})

test('confirmed protected effect after K1 retirement is critical counterexample', () => {
  const report = evaluate([
    observed('SP-B-PINNED', 'native_assertion', 'ACCEPTED', 'A4'),
    observed('SP-B-PINNED', 'protected_effect', 'EXECUTED', 'A6')
  ])
  assert.equal(report.edges[1].verdict, 'UNPROTECTED_EFFECT')
})

test('forged and mutated observation cannot advance evidence state', () => {
  const valid = observed('SP-A-DYNAMIC', 'native_assertion', 'REJECTED', 'A3')
  const report = evaluate([{ ...valid, outcome: 'ACCEPTED' }, { ...valid, signature: 'AAAA' }])
  assert.equal(report.verifiedObservations, 0)
  assert.equal(report.rejectedObservations, 2)
  assert.equal(report.edges[0].verdict, 'UNKNOWN')
})

test('different issuer, run, party, key or stale observation are not accepted', () => {
  const valid = observed('SP-A-DYNAMIC', 'native_assertion', 'REJECTED', 'A3')
  const old = { ...valid, observedAt: '2026-11-10T15:00:00.000Z' }
  old.signature = sign(null, canonicalObservation(old), observer.privateKey).toString('base64')
  const report = evaluate([
    observed('SP-A-DYNAMIC', 'native_assertion', 'REJECTED', 'A3'),
    observed('SP-X-NOT-IN-INVENTORY', 'native_assertion', 'REJECTED', 'bad-party'),
    { ...valid, issuerId: 'other-issuer' },
    { ...valid, runId: 'other-run' },
    { ...valid, keyFingerprint: '0'.repeat(64) },
    old
  ])
  assert.equal(report.verifiedObservations, 1) // un-inventoried SP observations cannot inflate verified coverage
  assert.equal(report.rejectedObservations, 5)
  assert.equal(report.knownRelyingParties, 3)
  assert.equal(report.edges[0].verdict, 'NATIVE_REJECTED')
})

test('absence of known relying-party inventory never passes', () => {
  assert.throws(() => assessRetiredKeyCoverage({ ...scopes, relyingPartyIds: [] }), /invalid_relying_party_inventory/)
  assert.throws(() => assessRetiredKeyCoverage({ ...scopes, relyingPartyIds: ['SP-A-DYNAMIC', 'SP-A-DYNAMIC'] }), /invalid_relying_party_inventory/)
})

test('observer key must be pinned by host, not supplied by observation', () => {
  const report = assessRetiredKeyCoverage({ ...scopes, pinnedObserverKeys: {},
    observations: [observed('SP-A-DYNAMIC', 'native_assertion', 'REJECTED', 'A3')] })
  assert.equal(report.edges[0].verdict, 'UNKNOWN')
})
