/**
 * TTP Reference Issuer — API Gateway
 *
 * An Express middleware issuer that observes HTTP requests made by agents
 * and submits behavioral receipts to the Trust Authority.
 *
 * Usage:
 *   Attach as middleware on your Express application. The issuer
 *   automatically scores all requests and submits receipts asynchronously.
 *
 * Scoring model (see protocol/scoring-semantics.md for the full guide):
 *   1.0  — Successful request to expected endpoint
 *   0.95 — Successful request to unexpected endpoint (allowed but unusual)
 *   0.70 — Server error (5xx)
 *   0.35 — Rate limited (429)
 *   0.20 — Auth failure (401/403)
 *   0.55 — Other client error (4xx)
 *   0.75 — High latency (> 5s)
 */

import express, { Request, Response, NextFunction } from "express"
import { TTPIssuer } from "@ttp/sdk"

interface ApiGatewayIssuerOptions {
  issuerId: string
  privateKey: string
  authorityUrl: string
  authorityApiKey: string
  domain: string
  /** Agent ID header (default: x-agent-id) */
  agentIdHeader?: string
  /** Expected endpoint patterns — used to determine if an endpoint is "expected" */
  expectedPaths?: RegExp[]
  /** High-latency threshold in ms (default: 5000) */
  highLatencyThresholdMs?: number
}

export function createApiGatewayIssuer(options: ApiGatewayIssuerOptions) {
  const {
    agentIdHeader = "x-agent-id",
    expectedPaths = [],
    highLatencyThresholdMs = 5000
  } = options

  const issuer = new TTPIssuer({
    issuerId: options.issuerId,
    privateKey: options.privateKey,
    authorityUrl: options.authorityUrl,
    authorityApiKey: options.authorityApiKey,
    domain: options.domain
  })

  return function apiGatewayIssuerMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const startMs = Date.now()
    const agentId = req.headers[agentIdHeader] as string | undefined

    res.on("finish", () => {
      if (!agentId) return  // No agent ID header — skip

      const latencyMs = Date.now() - startMs
      const score = computeScore(req, res, latencyMs, expectedPaths, highLatencyThresholdMs)

      // Submit asynchronously — never block the response
      issuer.queueReceipt({
        agentId,
        eventType: "api_call",
        score,
        eventData: {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          latency_ms: latencyMs,
          agent_id_header: agentIdHeader
        }
      })
    })

    next()
  }
}

function computeScore(
  req: Request,
  res: Response,
  latencyMs: number,
  expectedPaths: RegExp[],
  highLatencyThresholdMs: number
): number {
  const { statusCode } = res

  // Auth failures — significant negative signal
  if (statusCode === 401 || statusCode === 403) return 0.20

  // Rate limited
  if (statusCode === 429) return 0.35

  // Other client errors
  if (statusCode >= 400 && statusCode < 500) return 0.55

  // Server errors — partial credit (may not be agent's fault)
  if (statusCode >= 500) return 0.70

  // Success path — check latency and path expectations
  const isHighLatency = latencyMs > highLatencyThresholdMs
  if (isHighLatency) return 0.75

  const isExpectedPath = expectedPaths.length === 0 ||
    expectedPaths.some(p => p.test(req.path))

  return isExpectedPath ? 1.0 : 0.90
}

// Standalone server example
if (require.main === module) {
  const app = express()
  app.use(express.json())

  // Attach issuer middleware
  app.use(createApiGatewayIssuer({
    issuerId: process.env.ISSUER_ID ?? "issuer-api-gateway-01",
    privateKey: process.env.ISSUER_PRIVATE_KEY ?? "",
    authorityUrl: process.env.AUTHORITY_URL ?? "http://localhost:3000",
    authorityApiKey: process.env.ISSUER_API_KEY ?? "",
    domain: process.env.DOMAIN ?? "retention",
    expectedPaths: [/^\/api\//]
  }))

  // Example protected route
  app.get("/api/data", (req, res) => {
    res.json({ data: "example response", agentId: req.headers["x-agent-id"] })
  })

  app.listen(4000, () => {
    console.log("[TTP API Gateway Issuer] Running on port 4000")
  })
}
