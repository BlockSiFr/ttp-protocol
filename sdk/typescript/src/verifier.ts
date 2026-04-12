/**
 * TTPVerifier — Service-side token verification.
 *
 * Implements the verification algorithm from protocol/spec.md §9.
 * All verification is stateless — no network calls at verification time.
 */

import { jwtVerify, createLocalJWKSet, importSPKI } from "jose"
import {
  VerificationOptions,
  VerificationResult,
  TTPTokenClaims,
  AuthorityKeySet,
  TTP_VERSION,
  VerificationRejectionReason
} from "./types"

// JTI replay detection cache (in-memory; use Redis in production)
const jtiCache = new Map<string, number>()

export class TTPVerifier {
  private readonly options: VerificationOptions

  constructor(options: VerificationOptions) {
    this.options = options
  }

  async verify(tokenString: string | undefined | null): Promise<VerificationResult> {
    return verifyTTPToken(tokenString, this.options)
  }
}

/**
 * Verify a TTP trust token.
 *
 * @param tokenString - The raw JWT string from the X-TTP-Token header
 * @param options - Verification requirements
 * @returns VerificationResult with valid=true and claims, or valid=false with reason
 */
export async function verifyTTPToken(
  tokenString: string | undefined | null,
  options: VerificationOptions
): Promise<VerificationResult> {
  const {
    domain,
    minScore,
    authorityPublicKey,
    minIssuerCount,
    clockSkewToleranceS = 30,
    replayDetection = false,
    replayDetectionTtlMs = 300_000
  } = options

  // Step 1: Check token presence
  if (!tokenString) {
    return reject("MISSING_TOKEN")
  }

  // Step 2: Decode header to get version before signature verification
  let claims: TTPTokenClaims
  try {
    // Decode without verification first to check version
    const rawClaims = decodeJwtPayloadUnsafe(tokenString) as Partial<TTPTokenClaims>

    // Step 2: Check ttp_version before wasting time on crypto
    if (rawClaims.ttp_version !== TTP_VERSION) {
      return reject("UNSUPPORTED_VERSION")
    }

    // Step 3: Verify signature and expiry via jose
    const publicKey = await resolvePublicKey(authorityPublicKey)
    const { payload } = await jwtVerify(tokenString, publicKey, {
      clockTolerance: clockSkewToleranceS
    })
    claims = payload as unknown as TTPTokenClaims
  } catch (err) {
    const msg = (err as Error).message ?? ""
    if (msg.includes("exp")) return reject("TOKEN_EXPIRED")
    if (msg.includes("signature")) return reject("INVALID_SIGNATURE")
    return reject("MALFORMED_TOKEN")
  }

  // Step 4: Domain check
  if (claims.ttp_domain !== domain) {
    return {
      valid: false,
      reason: "DOMAIN_MISMATCH",
      requiredDomain: domain,
      tokenDomain: claims.ttp_domain
    }
  }

  // Step 5: Score check
  if (claims.ttp_score < minScore) {
    return {
      valid: false,
      reason: "SCORE_BELOW_THRESHOLD",
      requiredScore: minScore,
      tokenScore: claims.ttp_score
    }
  }

  // Step 6: Issuer count check (optional)
  if (minIssuerCount !== undefined && claims.ttp_issuer_count < minIssuerCount) {
    return {
      valid: false,
      reason: "INSUFFICIENT_ISSUERS",
      claims
    }
  }

  // Step 7: JTI replay detection (optional)
  if (replayDetection && claims.jti) {
    if (jtiCache.has(claims.jti)) {
      return reject("INVALID_SIGNATURE") // Replay detected — treat as invalid
    }
    // Cache the JTI until the token would have expired
    jtiCache.set(claims.jti, Date.now())
    setTimeout(() => jtiCache.delete(claims.jti), replayDetectionTtlMs)
  }

  return { valid: true, claims }
}

function reject(reason: VerificationRejectionReason): VerificationResult {
  return { valid: false, reason }
}

async function resolvePublicKey(
  authorityPublicKey: string | AuthorityKeySet
): Promise<ReturnType<typeof createLocalJWKSet>> {
  if (typeof authorityPublicKey === "string") {
    // Treat as a single base64url-encoded Ed25519 public key
    const jwk = {
      keys: [
        {
          kty: "OKP",
          crv: "Ed25519",
          x: authorityPublicKey,
          use: "sig",
          kid: "default"
        }
      ]
    }
    return createLocalJWKSet(jwk as Parameters<typeof createLocalJWKSet>[0])
  }

  return createLocalJWKSet(authorityPublicKey as Parameters<typeof createLocalJWKSet>[0])
}

function decodeJwtPayloadUnsafe(jwt: string): unknown {
  const parts = jwt.split(".")
  if (parts.length !== 3) throw new Error("MALFORMED_TOKEN")
  const payload = parts[1]
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padding = (4 - (padded.length % 4)) % 4
  const json = Buffer.from(padded + "=".repeat(padding), "base64").toString("utf8")
  return JSON.parse(json)
}

/**
 * Fetch and cache the Trust Authority's public key set from its well-known endpoint.
 * Use this at service startup to initialize the verifier.
 */
export async function fetchTTPAuthorityKey(
  authorityUrl: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<AuthorityKeySet> {
  const url = `${authorityUrl.replace(/\/$/, "")}/.well-known/ttp-keys`
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch TTP authority keys from ${url}: ${response.status}`)
  }
  return response.json() as Promise<AuthorityKeySet>
}
