import { createPublicKey, verify } from 'node:crypto'

// Read-only evidence assessment. This does not verify SAML XML, authenticate a user,
// mutate relying-party configuration, or authorize an execution.
const signedFields = [
  'runId', 'observerId', 'issuerId', 'relyingPartyId', 'keyFingerprint',
  'challengeId', 'kind', 'outcome', 'observedAt'
]
const outcomes = {
  native_assertion: new Set(['ACCEPTED', 'REJECTED']),
  protected_effect: new Set(['EXECUTED', 'BLOCKED'])
}
const fingerprintPattern = /^[a-f0-9]{64}$/

export function canonicalObservation(observation) {
  if (!observation || signedFields.some(k => typeof observation[k] !== 'string' || !observation[k])) {
    throw new Error('incomplete_observation')
  }
  if (!fingerprintPattern.test(observation.keyFingerprint)) throw new Error('invalid_key_fingerprint')
  if (!outcomes[observation.kind]?.has(observation.outcome)) throw new Error('invalid_outcome')
  return Buffer.from(JSON.stringify(Object.fromEntries(signedFields.map(k => [k, observation[k]]))), 'utf8')
}

function verifyObservation(observation, { issuerId, keyFingerprint, runId, pinnedObserverKeys, nowMs, maxAgeMs }) {
  try {
    if (observation.issuerId !== issuerId || observation.keyFingerprint !== keyFingerprint || observation.runId !== runId) return false
    const observedAt = Date.parse(observation.observedAt)
    if (!Number.isFinite(observedAt) || observedAt > nowMs || nowMs - observedAt > maxAgeMs) return false
    const publicKey = pinnedObserverKeys[observation.observerId]
    if (!publicKey || typeof observation.signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(observation.signature)) return false
    return verify(null, canonicalObservation(observation), createPublicKey(publicKey), Buffer.from(observation.signature, 'base64'))
  } catch {
    return false
  }
}

/**
 * Classifies observed trust edges without claiming that an observation is genuine
 * merely because a caller says so. Observer keys must be pinned by the trusted host.
 * An accepted native assertion is NEVER reported as native retirement success.
 */
export function assessRetiredKeyCoverage({
  issuerId, keyFingerprint, runId, relyingPartyIds, observations = [],
  pinnedObserverKeys, assessedAt, maxObservationAgeSeconds = 3600
}) {
  if (!issuerId || !runId || !fingerprintPattern.test(keyFingerprint ?? '')) throw new Error('invalid_assessment_scope')
  if (!Array.isArray(relyingPartyIds) || relyingPartyIds.length === 0 ||
      relyingPartyIds.some(id => typeof id !== 'string' || !id) ||
      new Set(relyingPartyIds).size !== relyingPartyIds.length) throw new Error('invalid_relying_party_inventory')
  if (!Array.isArray(observations) || !pinnedObserverKeys || typeof pinnedObserverKeys !== 'object') throw new Error('invalid_evidence_input')
  const nowMs = Date.parse(assessedAt)
  if (!Number.isFinite(nowMs) || !Number.isFinite(maxObservationAgeSeconds) || maxObservationAgeSeconds <= 0) throw new Error('invalid_evaluation_time')
  const verified = observations.filter(o => relyingPartyIds.includes(o?.relyingPartyId) && verifyObservation(o, {
    issuerId, keyFingerprint, runId, pinnedObserverKeys, nowMs,
    maxAgeMs: maxObservationAgeSeconds * 1000
  }))
  const edges = relyingPartyIds.map(relyingPartyId => {
    const party = verified.filter(o => o.relyingPartyId === relyingPartyId)
    const native = party.filter(o => o.kind === 'native_assertion')
    const effects = party.filter(o => o.kind === 'protected_effect')
    // Any observed acceptance defeats the claim that this SP rejects K1.
    const nativeOutcome = native.some(o => o.outcome === 'ACCEPTED') ? 'ACCEPTED' :
      native.some(o => o.outcome === 'REJECTED') ? 'REJECTED' : 'UNKNOWN'
    // A block only constrains the same accepted assertion challenge, not any other test.
    const acceptedChallenges = new Set(native.filter(o => o.outcome === 'ACCEPTED').map(o => o.challengeId))
    const effectOutcome = effects.some(o => o.outcome === 'EXECUTED') ? 'EXECUTED' :
      effects.some(o => o.outcome === 'BLOCKED' && acceptedChallenges.has(o.challengeId)) ? 'BLOCKED' : 'UNKNOWN'
    let verdict = 'UNKNOWN'
    if (effectOutcome === 'EXECUTED') verdict = 'UNPROTECTED_EFFECT'
    else if (nativeOutcome === 'ACCEPTED' && effectOutcome === 'BLOCKED') verdict = 'RESIDUAL_TRUST_BLOCKED_AT_EFFECT'
    else if (nativeOutcome === 'ACCEPTED') verdict = 'NATIVE_ACCEPTANCE_UNCONTROLLED'
    else if (nativeOutcome === 'REJECTED') verdict = 'NATIVE_REJECTED'
    return {
      relyingPartyId, nativeOutcome, effectOutcome, verdict,
      evidenceChallengeIds: [...new Set(party.map(o => o.challengeId))].sort()
    }
  })
  return {
    evidenceState: 'SIGNED_OBSERVATION_ASSESSMENT_NOT_NATIVE_SAML_CERTIFICATION',
    issuerId, keyFingerprint, runId, knownRelyingParties: edges.length,
    verifiedObservations: verified.length,
    rejectedObservations: observations.length - verified.length,
    allKnownPartiesNativeReject: edges.every(e => e.verdict === 'NATIVE_REJECTED'),
    allKnownPartiesEffectConstrained: edges.every(e => ['NATIVE_REJECTED', 'RESIDUAL_TRUST_BLOCKED_AT_EFFECT'].includes(e.verdict)),
    edges
  }
}
