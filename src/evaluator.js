import { findProof, findSubject, findTrustClaim } from "./ast.js";
import { TtpError } from "./error.js";

export function evaluate(ast, { subject, at = "now" }) {
  const evaluatedAt = parseEvaluationTime(at);
  const subjectModel = findSubject(ast, subject);
  if (!subjectModel) {
    throw new TtpError("MISSING_SUBJECT", `Subject not found: ${subject}`);
  }

  const claim = findTrustClaim(ast, subject);
  if (!claim) {
    throw new TtpError("MISSING_TRUST", `Trust claim not found for subject: ${subject}`);
  }

  const proof = findProof(ast, subject);
  if (!proof) {
    throw new TtpError("MISSING_PROOF", `Proof not found for subject: ${subject}`);
  }

  if (proof.mode !== "cleartext-dev") {
    throw new TtpError("UNSUPPORTED_PROOF_MODE", `Unsupported proof mode: ${proof.mode}`);
  }

  const expiresAt = parseDate(claim.expires_at, "expires_at");
  if (evaluatedAt > expiresAt) {
    return result({
      subject,
      effectiveScore: 0,
      requiredScore: proof.required_score,
      outcome: "TRUST_PROOF_EXPIRED",
      reason: "trust claim expired before evaluation",
      proofMode: proof.mode,
      evaluatedAt,
      expiresAt
    });
  }

  if (proof.freshness) {
    const issuedAt = parseDate(claim.issued_at, "issued_at");
    const maxAgeMs = parseDuration(proof.freshness);
    if (evaluatedAt.getTime() - issuedAt.getTime() > maxAgeMs) {
      return result({
        subject,
        effectiveScore: 0,
        requiredScore: proof.required_score,
        outcome: "TRUST_PROOF_EXPIRED",
        reason: "trust proof is older than required freshness",
        proofMode: proof.mode,
        evaluatedAt,
        expiresAt
      });
    }
  }

  const effectiveScore = calculateEffectiveScore(claim, evaluatedAt);
  const requiredScore = Number(proof.required_score);

  if (effectiveScore >= requiredScore) {
    return result({
      subject,
      effectiveScore,
      requiredScore,
      outcome: "TRUST_PROOF_VALID",
      reason: "effective trust score meets threshold",
      proofMode: proof.mode,
      evaluatedAt,
      expiresAt
    });
  }

  return result({
    subject,
    effectiveScore,
    requiredScore,
    outcome: "TRUST_PROOF_INSUFFICIENT",
    reason: "effective trust score is below threshold",
    proofMode: proof.mode,
    evaluatedAt,
    expiresAt
  });
}

export function calculateEffectiveScore(claim, evaluatedAt) {
  const score = Number(claim.score);
  if (!claim.decay) {
    return roundScore(score);
  }

  if (claim.decay.model !== "linear") {
    throw new TtpError("UNSUPPORTED_DECAY_MODEL", `Unsupported decay model: ${claim.decay.model}`);
  }

  const issuedAt = parseDate(claim.issued_at, "issued_at");
  const elapsedMs = Math.max(0, evaluatedAt.getTime() - issuedAt.getTime());
  const halfLifeMs = parseDuration(claim.decay.half_life);
  const minimum = Number(claim.decay.minimum ?? 0);
  const periods = elapsedMs / halfLifeMs;
  const decayed = minimum + (score - minimum) * Math.pow(0.5, periods);

  return roundScore(Math.max(minimum, Math.min(score, decayed)));
}

export function parseDuration(duration) {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(String(duration));
  if (!match) {
    throw new TtpError("SYNTAX_ERROR", `Invalid duration: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
}

function parseEvaluationTime(at) {
  if (at === "now") {
    return new Date();
  }

  return parseDate(at, "at");
}

function parseDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TtpError("SYNTAX_ERROR", `Invalid ${field} timestamp: ${value}`);
  }
  return date;
}

function roundScore(score) {
  return Math.round(score * 10000) / 10000;
}

function result({ subject, effectiveScore, requiredScore, outcome, reason, proofMode, evaluatedAt, expiresAt }) {
  return {
    subject,
    effective_score: roundScore(effectiveScore),
    required_score: roundScore(requiredScore),
    result: outcome,
    reason,
    proof_mode: proofMode,
    evaluated_at: evaluatedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    receipt_hash_optional: null
  };
}
