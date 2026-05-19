/**
 * TTP Service Integration Example
 *
 * Demonstrates a service using TTP middleware to verify agent trust
 * before executing sensitive actions.
 *
 * To run:
 *   1. Start Trust Authority: cd reference-implementations/trust-authority && npm run dev
 *   2. npm install express @blocksifrdev/ttp-sdk
 *   3. ts-node examples/service-integration/index.ts
 *
 * Test with curl:
 *   # Without token (should fail with 401)
 *   curl -X POST http://localhost:4000/api/issue-discount \
 *     -H "Content-Type: application/json" \
 *     -d '{"customerId":"cust_1","discount":10}'
 *
 *   # With a token from the basic-agent example (should succeed)
 *   curl -X POST http://localhost:4000/api/issue-discount \
 *     -H "Content-Type: application/json" \
 *     -H "x-ttp-token: <your-token>" \
 *     -d '{"customerId":"cust_1","discount":10}'
 */

import express from "express"
import { createTTPMiddleware, fetchTTPAuthorityKey } from "@blocksifrdev/ttp-sdk"

const PORT = parseInt(process.env.PORT ?? "4000")
const AUTHORITY_URL = process.env.TTP_AUTHORITY_URL ?? "http://localhost:3000"
const MIN_SCORE = parseFloat(process.env.TTP_MIN_SCORE ?? "0.85")

async function main() {
  const app = express()
  app.use(express.json())

  // Fetch Trust Authority public key once at startup (cached for key rotation)
  console.log(`[Service] Fetching Trust Authority public keys from ${AUTHORITY_URL}`)
  const authorityPublicKey = await fetchTTPAuthorityKey(AUTHORITY_URL)
  console.log(`[Service] Loaded ${authorityPublicKey.keys.length} public key(s)`)

  // ─── Protected Routes ───────────────────────────────────────────────────────

  // High-value action: requires 0.85+ trust score, 2+ issuers
  app.post(
    "/api/issue-discount",
    createTTPMiddleware({
      domain: "retention",
      minScore: MIN_SCORE,
      authorityPublicKey,
      minIssuerCount: 1,
      fallback: "deny"
    }),
    async (req, res) => {
      // req.ttp is populated by the middleware after successful verification
      console.log(`[Service] Verified agent: ${req.ttp!.agentId} (score: ${req.ttp!.score})`)

      const { customerId, discountPercent, reason } = req.body as {
        customerId: string
        discountPercent: number
        reason: string
      }

      // Execute the trusted action
      const discountCode = `DISC-${Math.random().toString(36).toUpperCase().slice(2, 8)}`
      console.log(`[Service] Issuing discount ${discountPercent}% for customer ${customerId}: ${discountCode}`)

      res.json({
        success: true,
        discountCode,
        customerId,
        discountPercent,
        issuedBy: req.ttp!.agentId,
        agentTrustScore: req.ttp!.score
      })
    }
  )

  // Lower-stakes action: requires 0.70+ trust, 1 issuer
  app.post(
    "/api/send-notification",
    createTTPMiddleware({
      domain: "retention",
      minScore: 0.70,
      authorityPublicKey,
      fallback: "cached",
      cachedFallbackMaxAgeMs: 120_000  // Accept up to 2-minute-old tokens
    }),
    async (req, res) => {
      const { customerId, message } = req.body as {
        customerId: string
        message: string
      }

      console.log(`[Service] Sending notification to ${customerId}: "${message}"`)
      res.json({ success: true, notificationId: `notif_${Date.now()}` })
    }
  )

  // ─── Unprotected Routes ─────────────────────────────────────────────────────

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", ttp: { authorityUrl: AUTHORITY_URL, minScore: MIN_SCORE } })
  })

  app.listen(PORT, () => {
    console.log(`\n[Service] Running on port ${PORT}`)
    console.log(`[Service] TTP-protected endpoints:`)
    console.log(`  POST /api/issue-discount  (minScore: ${MIN_SCORE}, domain: retention)`)
    console.log(`  POST /api/send-notification (minScore: 0.70, domain: retention)`)
  })
}

main().catch(err => {
  console.error("[Service] Fatal:", err)
  process.exit(1)
})
