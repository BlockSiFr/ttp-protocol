import crypto from 'node:crypto';
import { canonicalize } from './util.mjs';
import { failure } from './errors.mjs';

// Production attestation verification requires a trusted, independently provisioned
// issuer -> Ed25519 public-key mapping. Cleartext-dev is explicit, never implicit.
export function verify_attestation({
  attestation, subject, requiredType, requiredIssuer, validAt, maxAge,
  requiredClaims = [], verificationMode = 'signed', trustedIssuerKeys = {}
}) {
  const r = [];
  if (!attestation || typeof attestation !== 'object') {
    return { valid:false, cryptographicallyVerified:false, failureReasons:[failure('INVALID_INPUT','attestation is required')] };
  }
  if (attestation.subject !== subject) r.push(failure('INVALID_SUBJECT','subject mismatch'));
  if (requiredIssuer && attestation.issuer !== requiredIssuer) r.push(failure('INVALID_ISSUER','issuer mismatch'));
  if (requiredType && attestation.type !== requiredType) r.push(failure('INVALID_INPUT','type mismatch'));
  const at = Date.parse(validAt);
  const issued = Date.parse(attestation.issuedAt);
  const expiry = Date.parse(attestation.expiresAt);
  if (![at,issued,expiry].every(Number.isFinite)) r.push(failure('INVALID_INPUT','timestamps are missing or malformed'));
  else {
    if (issued > at) r.push(failure('FUTURE_ATTESTATION','attestation has not been issued'));
    if (expiry < at || expiry <= issued) r.push(failure('EXPIRED_ATTESTATION','expired or inverted validity'));
    if (maxAge != null && (!Number.isFinite(maxAge) || maxAge < 0 || (at-issued)/1000 > maxAge))
      r.push(failure('STALE_ATTESTATION','stale'));
  }
  if (attestation.revoked === true) r.push(failure('REVOKED_ATTESTATION','issuer revoked the attestation'));
  for (const c of requiredClaims) {
    if (!(c in (attestation.claims ?? {}))) r.push(failure('INVALID_INPUT',`missing claim ${c}`));
  }
  let cryptographicallyVerified = false;
  if (verificationMode === 'signed') {
    const pem = Object.hasOwn(trustedIssuerKeys, attestation.issuer) ? trustedIssuerKeys[attestation.issuer] : null;
    const signature = attestation.signature;
    if (!pem || signature?.alg !== 'ed25519' || typeof signature.value !== 'string') {
      r.push(failure('UNTRUSTED_ATTESTATION','trusted issuer key and Ed25519 signature required'));
    } else {
      try {
        const { signature: _signature, ...signedPayload } = attestation;
        cryptographicallyVerified = crypto.verify(null, Buffer.from(canonicalize(signedPayload)),
          crypto.createPublicKey(pem), Buffer.from(signature.value, 'base64'));
        if (!cryptographicallyVerified) r.push(failure('SIGNATURE_INVALID','attestation signature invalid'));
      } catch {
        r.push(failure('SIGNATURE_INVALID','invalid issuer verification key or signature'));
      }
    }
  } else if (verificationMode !== 'cleartext-dev') {
    r.push(failure('UNSUPPORTED_PROOF_MODE','unsupported attestation mode'));
  }
  const valid=r.length===0;
  return { valid, cryptographicallyVerified, verificationMode, subject, attestationRef:attestation.ref,
    issuer:attestation.issuer, type:attestation.type,
    trustScoreDelta:valid ? attestation.trustScoreDelta ?? 0 : undefined,
    verifiedAt:validAt, failureReasons:r };
}
