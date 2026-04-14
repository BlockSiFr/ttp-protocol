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

export type IssuerType = "infrastructure" | "agent_peer"

export interface RegisteredIssuer {
  issuer_id: string
  public_key_b64: string  // base64url-encoded Ed25519 public key
  domain: string
  description?: string
  registered_at: number
  active: boolean
  /** Issuer type — defaults to "infrastructure" if omitted */
  issuer_type?: IssuerType
  /**
   * For agent_peer issuers: the agent_id of the attesting agent.
   * MUST match an agent registered in the Trust Authority.
   * SHOULD be identical to issuer_id.
   */
  peer_agent_id?: string
  /**
   * Minimum trust score the attesting agent must hold at submission time.
   * Defaults to 0.90 (the protocol minimum for peer issuers).
   */
  min_attester_score?: number
  /**
   * External confirmation URL. If set, the Trust Authority POSTs a
   * confirmation request before accepting any peer receipt from this issuer.
   * A non-approved response MUST cause the receipt to be rejected.
   */
  confirmation_url?: string
}

export type AgentStatus = "active" | "quarantined" | "blocked"
export type QuarantineMode = "auto" | "manual" | "supervised"

export interface RegisteredAgent {
  agent_id: string
  api_key: string
  description?: string
  registered_at: number
  blocked: boolean
  blocked_reason?: string
  // Quarantine fields (§18)
  quarantine_mode?: QuarantineMode
  quarantine_reason?: string
  quarantined_at?: number
  /** Unix ms. If set and in the past, the quarantine has expired and is auto-lifted. */
  quarantine_expires_at?: number
}

export interface TrustProvisioningGrant {
  grant_id: string
  agent_id: string
  domain: string
  score: number
  duration_s: number
  reason: string
  granted_at: number
  /** receipt_id values of the synthetic receipts created by this grant */
  receipt_ids: string[]
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
  | "AGENT_BLOCKED"
  | "AGENT_QUARANTINED"
  | "INSUFFICIENT_TRUST_DATA"
  | "PEER_ATTESTER_INELIGIBLE"
  | "PEER_CONFIRMATION_DENIED"
  | "PEER_CONFIRMATION_TIMEOUT"

// ─── Peer Receipt ─────────────────────────────────────────────────────────────

export interface PeerReceiptSubmission {
  receipt: BehavioralReceipt
  /** The attesting agent's current trust token (JWT string) */
  attester_token: string
}

export interface PeerConfirmationRequest {
  receipt_id: string
  attesting_agent_id: string
  subject_agent_id: string
  score: number
  domain: string
  observation_context?: string
  attester_score: number
  timestamp: number
}

export interface PeerConfirmationResponse {
  approved: boolean
  reason?: string
}
