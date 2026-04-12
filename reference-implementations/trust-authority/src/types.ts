/**
 * TTP Protocol Type Definitions
 */

export const TTP_VERSION = "1.0"

export interface BehavioralReceipt {
  ttp_version: string
  receipt_id: string
  agent_id: string
  issuer_id: string
  event_type: string
  event_data?: Record<string, unknown>
  domain: string
  timestamp: number
  score: number
  signature: string
}

export interface TrustTokenPayload {
  ttp_version: string
  sub: string
  iss: string
  iat: number
  exp: number
  jti: string
  ttp_domain: string
  ttp_score: number
  ttp_issuer_count: number
  ttp_receipt_window: number
}

export interface RegisteredIssuer {
  issuer_id: string
  public_key_b64: string  // base64url-encoded Ed25519 public key
  domain: string
  description?: string
  registered_at: number
  active: boolean
}

export interface RegisteredAgent {
  agent_id: string
  api_key: string
  description?: string
  registered_at: number
  blocked: boolean
  blocked_reason?: string
}

export interface StoredReceipt extends BehavioralReceipt {
  accepted_at: number
}

export interface AggregationResult {
  score: number
  contributingReceipts: number
  contributingIssuers: number
  oldestReceiptAgeS: number
}

export interface TokenIssuanceRequest {
  agent_id: string
  domain: string
  requested_ttl?: number
}

export interface TokenIssuanceResponse {
  token: string
  expires_at: number
  score: number
  issuer_count: number
}

export type ReceiptSubmissionResult =
  | { status: "accepted"; receipt_id: string }
  | { status: "duplicate"; receipt_id: string }

export interface TTPError {
  error: string
  message: string
  receipt_id?: string
}

export type VerificationRejectionReason =
  | "MISSING_TOKEN"
  | "INVALID_SIGNATURE"
  | "TOKEN_EXPIRED"
  | "DOMAIN_MISMATCH"
  | "SCORE_BELOW_THRESHOLD"
  | "UNSUPPORTED_VERSION"
  | "INSUFFICIENT_ISSUERS"
  | "INVALID_SCHEMA"
  | "SCORE_OUT_OF_RANGE"
  | "RECEIPT_TOO_OLD"
  | "RECEIPT_FUTURE_DATED"
  | "ISSUER_NOT_REGISTERED"
  | "UNSUPPORTED_VERSION"
  | "AGENT_BLOCKED"
  | "INSUFFICIENT_TRUST_DATA"
