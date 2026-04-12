export const TTP_VERSION = "1.0"
export const TTP_TOKEN_HEADER = "x-ttp-token"

// ─── Token Claims ─────────────────────────────────────────────────────────────

export interface TTPTokenClaims {
  ttp_version: string
  sub: string           // agent_id
  iss: string           // authority URL
  iat: number
  exp: number
  jti: string
  ttp_domain: string
  ttp_score: number
  ttp_issuer_count: number
  ttp_receipt_window: number
}

export interface TrustToken {
  value: string         // raw JWT string
  claims: TTPTokenClaims
  expiresAt: number     // Unix timestamp in seconds
  domain: string
  score: number
  issuerCount: number
}

// ─── Client Options ───────────────────────────────────────────────────────────

export interface TTPClientOptions {
  /** Your agent's unique identifier */
  agentId: string
  /** API key for authenticating with the Trust Authority */
  apiKey: string
  /** Base URL of the Trust Authority */
  authorityUrl: string
  /** Domain-specific defaults */
  domains?: Record<string, { minScore?: number; requestedTtl?: number }>
  /** Fetch implementation (default: global fetch) */
  fetch?: typeof fetch
}

export interface GetTrustTokenOptions {
  /** Trust domain to request a token for */
  domain: string
  /** Requested TTL in seconds (Trust Authority may issue shorter) */
  requestedTtl?: number
  /** Force-refresh even if a valid cached token exists */
  forceRefresh?: boolean
}

// ─── Verification ─────────────────────────────────────────────────────────────

export interface VerificationOptions {
  /** Required trust domain */
  domain: string
  /** Minimum required trust score (0.0–1.0) */
  minScore: number
  /**
   * Trust Authority public key: base64url-encoded Ed25519 public key
   * OR the full /.well-known/ttp-keys JSON (for key rotation support)
   */
  authorityPublicKey: string | AuthorityKeySet
  /** Minimum number of contributing issuers */
  minIssuerCount?: number
  /** Clock skew tolerance in seconds (default: 30) */
  clockSkewToleranceS?: number
  /** Enable JTI replay detection */
  replayDetection?: boolean
  /** TTL for replay detection cache in ms (default: 300000) */
  replayDetectionTtlMs?: number
}

export interface AuthorityKeySet {
  keys: Array<{
    kid: string
    kty: string
    crv: string
    x: string
    use: string
  }>
}

export interface VerificationResult {
  valid: boolean
  claims?: TTPTokenClaims
  reason?: VerificationRejectionReason
  requiredScore?: number
  tokenScore?: number
  requiredDomain?: string
  tokenDomain?: string
}

export type VerificationRejectionReason =
  | "MISSING_TOKEN"
  | "INVALID_SIGNATURE"
  | "TOKEN_EXPIRED"
  | "DOMAIN_MISMATCH"
  | "SCORE_BELOW_THRESHOLD"
  | "UNSUPPORTED_VERSION"
  | "INSUFFICIENT_ISSUERS"
  | "MALFORMED_TOKEN"

// ─── Middleware Options ───────────────────────────────────────────────────────

export type FallbackPolicy = "deny" | "cached" | "degrade"

export interface MiddlewareOptions extends VerificationOptions {
  /** Fallback policy when Trust Authority is unavailable (default: "deny") */
  fallback?: FallbackPolicy
  /** For "cached" fallback: accept expired tokens up to this many ms old */
  cachedFallbackMaxAgeMs?: number
}

// ─── Issuer Options ───────────────────────────────────────────────────────────

export interface IssuerOptions {
  issuerId: string
  /** base64url-encoded Ed25519 private key */
  privateKey: string
  authorityUrl: string
  authorityApiKey: string
  domain: string
  /** Fetch implementation (default: global fetch) */
  fetch?: typeof fetch
}

export interface ReceiptSubmissionOptions {
  agentId: string
  eventType: string
  score: number
  eventData?: Record<string, unknown>
  timestamp?: number  // defaults to now
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class TTPUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "TTPUnavailableError"
  }
}

export class TTPVerificationError extends Error {
  constructor(
    message: string,
    public readonly reason: VerificationRejectionReason
  ) {
    super(message)
    this.name = "TTPVerificationError"
  }
}
