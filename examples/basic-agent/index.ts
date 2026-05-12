/**
 * TTP Basic Agent Example
 *
 * Demonstrates a minimal AI agent using TTP to call a protected service.
 *
 * To run this example:
 *   1. Start the Trust Authority: cd reference-implementations/trust-authority && npm run dev
 *   2. Install dependencies from this repo until the SDK is published: npm install ./sdk/typescript
 *   3. Run: ts-node examples/basic-agent/index.ts
 */

import { TTPClient, TTPUnavailableError } from "@ttp/sdk"

// Configuration

const AUTHORITY_URL = process.env.TTP_AUTHORITY_URL ?? "http://localhost:3000"
const AGENT_ID = process.env.TTP_AGENT_ID ?? "agent-dev-001"
const AGENT_API_KEY = process.env.TTP_API_KEY ?? "dev-agent-key"
const SERVICE_URL = process.env.SERVICE_URL ?? "http://localhost:4000"

// Initialize TTP Client

const ttp = new TTPClient({
  agentId: AGENT_ID,
  apiKey: AGENT_API_KEY,
  authorityUrl: AUTHORITY_URL
})

// Agent Logic

async function run() {
  console.log(`[Agent] Starting — ID: ${AGENT_ID}`)
  console.log(`[Agent] Trust Authority: ${AUTHORITY_URL}`)

  // Step 1: Request a trust token for the "retention" domain
  console.log("\n[Agent] Requesting trust token for domain: retention")

  let token
  try {
    token = await ttp.getTrustToken({ domain: "retention" })
    console.log(`[Agent] Got trust token`)
    console.log(`[Agent]   Score: ${token.score}`)
    console.log(`[Agent]   Issuer count: ${token.issuerCount}`)
    console.log(`[Agent]   Expires: ${new Date(token.expiresAt * 1000).toISOString()}`)
  } catch (err) {
    if (err instanceof TTPUnavailableError) {
      console.error(`[Agent] Trust Authority unavailable: ${err.message}`)
      console.error("[Agent] Applying fallback policy: deny")
      process.exit(1)
    }
    throw err
  }

  // Step 2: Call the protected service with the trust token
  console.log("\n[Agent] Calling protected service...")

  const response = await fetch(`${SERVICE_URL}/api/issue-discount`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-id": AGENT_ID,
      "x-ttp-token": token.value
    },
    body: JSON.stringify({
      customerId: "customer-123",
      discountPercent: 10,
      reason: "retention-offer"
    })
  })

  if (response.ok) {
    const result = await response.json()
    console.log(`[Agent] Service call succeeded:`, result)
  } else if (response.status === 403) {
    const error = await response.json()
    console.error(`[Agent] Service rejected request — insufficient trust`)
    console.error(`[Agent]   Reason: ${error.reason}`)
    console.error(`[Agent]   Required score: ${error.required_score}`)
    console.error(`[Agent]   Token score: ${error.token_score}`)
  } else {
    console.error(`[Agent] Service returned ${response.status}`)
  }

  // Step 3: Token is cached — subsequent calls reuse it
  console.log("\n[Agent] Making second call (uses cached token)...")
  const token2 = await ttp.getTrustToken({ domain: "retention" })
  console.log(`[Agent] Reused cached token (same jti: ${token2.claims.jti === token.claims.jti})`)
}

run().catch(console.error)
