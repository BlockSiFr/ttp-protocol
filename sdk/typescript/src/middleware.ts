/**
 * Express / Connect middleware for TTP token verification.
 *
 * @example
 * ```typescript
 * import { createTTPMiddleware } from "@ttp/sdk"
 *
 * app.use("/api/issue-discount", createTTPMiddleware({
 *   domain: "retention",
 *   minScore: 0.85,
 *   authorityPublicKey: process.env.TTP_AUTHORITY_PUBLIC_KEY
 * }))
 * ```
 */

import { Request, Response, NextFunction } from "express"
import { verifyTTPToken } from "./verifier"
import { MiddlewareOptions, TTP_TOKEN_HEADER, TTPTokenClaims } from "./types"

// Augment Express Request type
declare global {
  namespace Express {
    interface Request {
      ttp?: {
        agentId: string
        score: number
        domain: string
        issuerCount: number
        claims: TTPTokenClaims
        /** True if the agent is currently under quarantine (§18) */
        quarantined: boolean
        /** Quarantine mode when quarantined is true */
        quarantineMode?: string
      }
    }
  }
}

/**
 * Create Express middleware that verifies TTP trust tokens.
 *
 * On success: attaches `req.ttp` with verified claims and calls `next()`.
 * On failure: returns 403 with JSON error body.
 */
export function createTTPMiddleware(options: MiddlewareOptions) {
  const {
    fallback = "deny",
    cachedFallbackMaxAgeMs = 300_000,
    denyQuarantined = false,
    ...verificationOptions
  } = options

  return async function ttpMiddleware(req: Request, res: Response, next: NextFunction) {
    const tokenString = req.headers[TTP_TOKEN_HEADER] as string | undefined

    if (!tokenString) {
      return res.status(401).json({
        error: "TTP_VERIFICATION_FAILED",
        reason: "MISSING_TOKEN",
        message: `Request must include a trust token in the ${TTP_TOKEN_HEADER} header`
      })
    }

    let result
    try {
      result = await verifyTTPToken(tokenString, verificationOptions)
    } catch (err) {
      // Trust Authority unavailability doesn't affect verification (stateless)
      // but log the error for monitoring
      console.error("[TTP Verifier] Verification error:", err)
      return res.status(500).json({ error: "INTERNAL_ERROR" })
    }

    if (!result.valid) {
      const status = result.reason === "MISSING_TOKEN" ? 401 : 403

      return res.status(status).json({
        error: "TTP_VERIFICATION_FAILED",
        reason: result.reason,
        ...(result.requiredScore !== undefined && {
          required_score: result.requiredScore,
          token_score: result.tokenScore
        }),
        ...(result.requiredDomain && {
          required_domain: result.requiredDomain,
          token_domain: result.tokenDomain
        }),
        domain: options.domain
      })
    }

    const claims = result.claims!
    const isQuarantined = claims.ttp_quarantined === true

    // Optionally deny quarantined agents regardless of score (§18.4)
    if (denyQuarantined && isQuarantined) {
      return res.status(403).json({
        error: "TTP_VERIFICATION_FAILED",
        reason: "AGENT_QUARANTINED",
        quarantine_mode: claims.ttp_quarantine_mode,
        domain: options.domain,
        message: "Agent is under quarantine and is not permitted to perform this action"
      })
    }

    // Attach verified claims to request
    req.ttp = {
      agentId: claims.sub,
      score: claims.ttp_score,
      domain: claims.ttp_domain,
      issuerCount: claims.ttp_issuer_count,
      claims,
      quarantined: isQuarantined,
      quarantineMode: claims.ttp_quarantine_mode
    }

    next()
  }
}
