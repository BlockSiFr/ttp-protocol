/**
 * @blocksifr/ttp-sdk — Official TypeScript SDK for the Trust Transfer Protocol
 *
 * @example Agent usage:
 * ```typescript
 * import { TTPClient } from "@blocksifr/ttp-sdk"
 *
 * const client = new TTPClient({
 *   agentId: "my-agent",
 *   apiKey: process.env.TTP_API_KEY,
 *   authorityUrl: "https://authority.example.com"
 * })
 *
 * const token = await client.getTrustToken({ domain: "retention" })
 * ```
 *
 * @example Service verification:
 * ```typescript
 * import { createTTPMiddleware } from "@blocksifr/ttp-sdk"
 *
 * app.use("/api/action", createTTPMiddleware({
 *   domain: "retention",
 *   minScore: 0.85,
 *   authorityPublicKey: process.env.TTP_AUTHORITY_PUBLIC_KEY
 * }))
 * ```
 */

export { TTPClient } from "./client"
export { TTPVerifier, verifyTTPToken } from "./verifier"
export { createTTPMiddleware } from "./middleware"
export { TTPIssuer, TTPPeerIssuer } from "./issuer"
export type {
  TTPClientOptions,
  GetTrustTokenOptions,
  TrustToken,
  VerificationOptions,
  VerificationResult,
  MiddlewareOptions,
  IssuerOptions,
  ReceiptSubmissionOptions,
  PeerIssuerOptions,
  PeerReceiptSubmissionOptions,
  TTPTokenClaims,
  TTPUnavailableError,
  TTPVerificationError
} from "./types"
