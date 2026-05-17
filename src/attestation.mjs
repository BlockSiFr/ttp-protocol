const VALID_RISK_TIERS = new Set(['low', 'medium', 'high', 'critical']);

export function verify_attestation({ attestation, subject, validAt = new Date().toISOString() } = {}) {
  const failureReasons = [];

  if (!attestation || typeof attestation !== 'object') {
    failureReasons.push(reason('missing_attestation', 'Attestation object is required.'));
    return { valid: false, failureReasons };
  }

  if (!attestation.subject) {
    failureReasons.push(reason('missing_subject', 'Attestation subject is required.'));
  } else if (subject && attestation.subject !== subject) {
    failureReasons.push(reason('subject_mismatch', 'Attestation subject does not match the requested subject.'));
  }

  if (!attestation.issuer) {
    failureReasons.push(reason('missing_issuer', 'Attestation issuer is required.'));
  }

  if (!attestation.issuedAt || Number.isNaN(Date.parse(attestation.issuedAt))) {
    failureReasons.push(reason('invalid_issued_at', 'Attestation issuedAt must be a valid date-time.'));
  }

  const validAtMs = Date.parse(validAt);
  if (Number.isNaN(validAtMs)) {
    failureReasons.push(reason('invalid_valid_at', 'validAt must be a valid date-time.'));
  }

  if (attestation.expiresAt) {
    const expiresAtMs = Date.parse(attestation.expiresAt);
    if (Number.isNaN(expiresAtMs)) {
      failureReasons.push(reason('invalid_expires_at', 'Attestation expiresAt must be a valid date-time.'));
    } else if (!Number.isNaN(validAtMs) && expiresAtMs < validAtMs) {
      failureReasons.push(reason('attestation_expired', 'Attestation is expired.'));
    }
  }

  if (attestation.riskTier && !VALID_RISK_TIERS.has(attestation.riskTier)) {
    failureReasons.push(reason('invalid_risk_tier', 'Attestation riskTier is invalid.'));
  }

  return {
    valid: failureReasons.length === 0,
    failureReasons,
  };
}

function reason(code, message) {
  return { code, message };
}
