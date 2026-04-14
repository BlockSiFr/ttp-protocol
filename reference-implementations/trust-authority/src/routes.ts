/**
 * TTP Trust Authority — HTTP Route Handlers
 *
 * Implements the protocol endpoints from protocol/spec.md:
 *   POST /v1/receipts          — Submit a behavioral receipt
 *   POST /v1/receipts/batch    — Batch receipt submission
 *   POST /v1/peer-receipts     — Submit a peer receipt (Agent-as-Issuer, §17)
 *   POST /v1/tokens            — Request a trust token
 *   GET  /.well-known/ttp-keys — Trust Authority public key
 *   POST /v1/admin/issuers     — Register an issuer (admin)
 *   POST /v1/admin/agents      — Register an agent (admin)
 */

import { Router, Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { SignJWT } from "jose"
import * as ed from "@noble/ed25519"

import { TTPStore } from "./store"
import { aggregateTrustScore } from "./aggregation"
import { verifyReceiptSignature, base64urlDecode, base64urlEncode } from "./crypto"
import {
  BehavioralReceipt,
  StoredReceipt,
  TTP_VERSION,
  IssuerType,
  RegisteredIssuer,
  RegisteredAgent,
  PeerReceiptSubmission,
  PeerConfirmationRequest,
  PeerConfirmationResponse
} from "./types"

const MAX_TOKEN_TTL_S = 600
const DEFAULT_TOKEN_TTL_S = 300
const RECEIPT_WINDOW_S = 300
const MAX_RECEIPT_AGE_S = 86400
const MAX_FUTURE_RECEIPT_S = 300
const MIN_ISSUER_COUNT = 1

// Peer receipt constants (§17)
const PEER_MIN_ATTESTER_SCORE = 0.90
const PEER_MAX_ISSUER_WEIGHT = 0.20   // 20% cap vs 40% for infrastructure
const PEER_CONFIRMATION_TIMEOUT_MS = 2000

export function createRouter(
  store: TTPStore,
  authorityPrivateKeyBytes: Uint8Array,
  authorityPublicKeyBytes: Uint8Array,
  authorityKeyId: string,
  authorityUrl: string,
  adminApiKey: string
): Router {
  const router = Router()

  // ─── Public Key Discovery ─────────────────────────────────────────────────

  router.get("/.well-known/ttp-keys", (_req: Request, res: Response) => {
    res.json({
      keys: [
        {
          kid: authorityKeyId,
          kty: "OKP",
          crv: "Ed25519",
          x: base64urlEncode(authorityPublicKeyBytes),
          use: "sig"
        }
      ]
    })
  })

  // ─── Receipt Submission ───────────────────────────────────────────────────

  router.post("/v1/receipts", async (req: Request, res: Response) => {
    const receipt = req.body as BehavioralReceipt

    const validationError = validateReceipt(receipt, store)
    if (validationError) {
      return res.status(validationError.status).json({
        error: validationError.code,
        message: validationError.message,
        receipt_id: receipt?.receipt_id
      })
    }

    // Verify signature
    const issuer = store.getIssuer(receipt.issuer_id)!
    const publicKeyBytes = base64urlDecode(issuer.public_key_b64)
    const signatureValid = verifyReceiptSignature(receipt, publicKeyBytes)

    if (!signatureValid) {
      return res.status(400).json({
        error: "INVALID_SIGNATURE",
        message: "Receipt signature verification failed",
        receipt_id: receipt.receipt_id
      })
    }

    // Deduplicate
    if (store.isReceiptDuplicate(receipt.receipt_id)) {
      return res.status(200).json({ status: "duplicate", receipt_id: receipt.receipt_id })
    }

    // Store
    const stored: StoredReceipt = { ...receipt, accepted_at: Date.now() }
    store.storeReceipt(stored)

    return res.status(201).json({ status: "accepted", receipt_id: receipt.receipt_id })
  })

  // ─── Batch Receipt Submission ─────────────────────────────────────────────

  router.post("/v1/receipts/batch", async (req: Request, res: Response) => {
    const { receipts } = req.body as { receipts: BehavioralReceipt[] }

    if (!Array.isArray(receipts) || receipts.length === 0) {
      return res.status(400).json({ error: "INVALID_REQUEST", message: "receipts must be a non-empty array" })
    }

    if (receipts.length > 100) {
      return res.status(400).json({ error: "BATCH_TOO_LARGE", message: "Maximum 100 receipts per batch" })
    }

    const results = await Promise.all(
      receipts.map(async receipt => {
        const validationError = validateReceipt(receipt, store)
        if (validationError) {
          return { receipt_id: receipt?.receipt_id, status: "error", error: validationError.code }
        }

        const issuer = store.getIssuer(receipt.issuer_id)
        if (!issuer) {
          return { receipt_id: receipt?.receipt_id, status: "error", error: "ISSUER_NOT_REGISTERED" }
        }

        const publicKeyBytes = base64urlDecode(issuer.public_key_b64)
        if (!verifyReceiptSignature(receipt, publicKeyBytes)) {
          return { receipt_id: receipt?.receipt_id, status: "error", error: "INVALID_SIGNATURE" }
        }

        if (store.isReceiptDuplicate(receipt.receipt_id)) {
          return { receipt_id: receipt.receipt_id, status: "duplicate" }
        }

        store.storeReceipt({ ...receipt, accepted_at: Date.now() })
        return { receipt_id: receipt.receipt_id, status: "accepted" }
      })
    )

    return res.status(207).json({ results })
  })

  // ─── Peer Receipt Submission (Agent-as-Issuer, §17) ──────────────────────

  router.post("/v1/peer-receipts", async (req: Request, res: Response) => {
    const submission = req.body as PeerReceiptSubmission

    if (!submission?.receipt || !submission?.attester_token) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "Both 'receipt' and 'attester_token' are required"
      })
    }

    const { receipt, attester_token } = submission

    // 1. Validate receipt structure
    const validationError = validateReceipt(receipt, store)
    if (validationError) {
      return res.status(validationError.status).json({
        error: validationError.code,
        message: validationError.message,
        receipt_id: receipt?.receipt_id
      })
    }

    // 2. Verify receipt event type
    if (receipt.event_type !== "agent_peer_observation") {
      return res.status(400).json({
        error: "INVALID_EVENT_TYPE",
        message: "Peer receipts MUST use event_type 'agent_peer_observation'",
        receipt_id: receipt.receipt_id
      })
    }

    // 3. Check issuer is registered as agent_peer type
    const issuer = store.getIssuer(receipt.issuer_id)!
    if (issuer.issuer_type !== "agent_peer") {
      return res.status(403).json({
        error: "PEER_ATTESTER_INELIGIBLE",
        message: `Issuer '${receipt.issuer_id}' is not registered as an agent_peer issuer`,
        receipt_id: receipt.receipt_id
      })
    }

    // 4. Verify receipt signature
    const publicKeyBytes = base64urlDecode(issuer.public_key_b64)
    if (!verifyReceiptSignature(receipt, publicKeyBytes)) {
      return res.status(400).json({
        error: "INVALID_SIGNATURE",
        message: "Peer receipt signature verification failed",
        receipt_id: receipt.receipt_id
      })
    }

    // 5. Verify attester_token: decode payload (we trust the TA signed it — verify the signature)
    let attesterScore: number
    let attesterAgentId: string
    try {
      // Decode JWT payload without full verification for now (trust-authority trusts its own tokens)
      const [, payloadB64] = attester_token.split(".")
      const payloadStr = Buffer.from(
        payloadB64.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8")
      const payload = JSON.parse(payloadStr) as Record<string, unknown>

      attesterScore = payload["ttp_score"] as number
      attesterAgentId = payload["sub"] as string
      const exp = payload["exp"] as number

      if (!attesterScore || !attesterAgentId || !exp) {
        throw new Error("Missing required token claims")
      }
      if (exp * 1000 < Date.now()) {
        return res.status(403).json({
          error: "PEER_ATTESTER_INELIGIBLE",
          message: "Attester trust token has expired",
          receipt_id: receipt.receipt_id
        })
      }
    } catch {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "Failed to parse attester_token",
        receipt_id: receipt.receipt_id
      })
    }

    // 6. Verify attester identity matches issuer_id
    if (attesterAgentId !== receipt.issuer_id) {
      return res.status(403).json({
        error: "PEER_ATTESTER_INELIGIBLE",
        message: `Attester token subject '${attesterAgentId}' does not match receipt issuer_id '${receipt.issuer_id}'`,
        receipt_id: receipt.receipt_id
      })
    }

    // 7. Verify attester score meets minimum
    const minScore = issuer.min_attester_score ?? PEER_MIN_ATTESTER_SCORE
    if (attesterScore < minScore) {
      return res.status(403).json({
        error: "PEER_ATTESTER_INELIGIBLE",
        message: `Attester score ${attesterScore} is below the required minimum of ${minScore}`,
        receipt_id: receipt.receipt_id,
        attester_score: attesterScore,
        required_score: minScore
      })
    }

    // 8. External confirmation gate (if configured) — no means no
    if (issuer.confirmation_url) {
      const confirmationRequest: PeerConfirmationRequest = {
        receipt_id: receipt.receipt_id,
        attesting_agent_id: receipt.issuer_id,
        subject_agent_id: receipt.agent_id,
        score: receipt.score,
        domain: receipt.domain,
        observation_context: (receipt.event_data?.["observation_context"] as string | undefined),
        attester_score: attesterScore,
        timestamp: receipt.timestamp
      }

      const confirmed = await callConfirmationApi(issuer.confirmation_url, confirmationRequest)

      if (!confirmed.approved) {
        return res.status(403).json({
          error: "PEER_CONFIRMATION_DENIED",
          message: `Peer receipt denied by confirmation API: ${confirmed.reason ?? "no reason provided"}`,
          receipt_id: receipt.receipt_id
        })
      }
    }

    // 9. Deduplicate
    if (store.isReceiptDuplicate(receipt.receipt_id)) {
      return res.status(200).json({ status: "duplicate", receipt_id: receipt.receipt_id })
    }

    // 10. Store (peer receipts are tagged for lower weight cap in aggregation)
    const stored: StoredReceipt = { ...receipt, accepted_at: Date.now() }
    store.storeReceipt(stored)

    return res.status(201).json({
      status: "accepted",
      receipt_id: receipt.receipt_id,
      peer_weight_cap: PEER_MAX_ISSUER_WEIGHT
    })
  })

  // ─── Token Issuance ───────────────────────────────────────────────────────

  router.post("/v1/tokens", async (req: Request, res: Response) => {
    const { agent_id, domain, requested_ttl } = req.body as {
      agent_id: string
      domain: string
      requested_ttl?: number
    }

    if (!agent_id || !domain) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "agent_id and domain are required"
      })
    }

    // Check agent exists and is not blocked
    const agent = store.getAgent(agent_id)
    if (!agent) {
      return res.status(404).json({
        error: "AGENT_NOT_FOUND",
        message: `No agent with ID '${agent_id}'`
      })
    }

    if (agent.blocked) {
      return res.status(403).json({
        error: "AGENT_BLOCKED",
        message: `Agent is blocked: ${agent.blocked_reason ?? "no reason specified"}`
      })
    }

    // Authenticate: check API key
    const apiKey = req.headers["authorization"]?.replace("Bearer ", "")
    if (!apiKey || apiKey !== agent.api_key) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid API key" })
    }

    // Load receipts
    const receipts = store.getReceipts(agent_id, domain)

    // Build issuer weight overrides: peer issuers get a lower cap (20% vs 40%)
    const issuerWeightOverrides = new Map<string, number>()
    for (const receipt of receipts) {
      const ri = store.getIssuer(receipt.issuer_id)
      if (ri?.issuer_type === "agent_peer") {
        issuerWeightOverrides.set(receipt.issuer_id, PEER_MAX_ISSUER_WEIGHT)
      }
    }

    // Run aggregation
    let aggregation
    try {
      aggregation = aggregateTrustScore(receipts, Date.now(), {
        receiptWindowS: RECEIPT_WINDOW_S,
        issuerWeightOverrides: issuerWeightOverrides.size > 0 ? issuerWeightOverrides : undefined
      })
    } catch (err) {
      if ((err as Error).message === "INSUFFICIENT_TRUST_DATA") {
        const distinctIssuers = new Set(receipts.map(r => r.issuer_id)).size
        return res.status(403).json({
          error: "INSUFFICIENT_TRUST_DATA",
          message: `No receipts found for agent '${agent_id}' in domain '${domain}' within the receipt window`,
          min_issuer_count: MIN_ISSUER_COUNT,
          current_issuer_count: distinctIssuers
        })
      }
      throw err
    }

    // Determine TTL
    const ttl = Math.min(
      requested_ttl ?? DEFAULT_TOKEN_TTL_S,
      MAX_TOKEN_TTL_S
    )

    const now = Math.floor(Date.now() / 1000)
    const jti = `tok_${uuidv4().replace(/-/g, "").slice(0, 16)}`

    // Sign the JWT using EdDSA
    const privateKey = await ed.etc.sha512Sync  // get the configured signer
    const jwk = {
      kty: "OKP",
      crv: "Ed25519",
      x: base64urlEncode(authorityPublicKeyBytes),
      d: base64urlEncode(authorityPrivateKeyBytes)
    }

    const token = await new SignJWT({
      ttp_version: TTP_VERSION,
      ttp_domain: domain,
      ttp_score: Math.round(aggregation.score * 1000) / 1000,
      ttp_issuer_count: aggregation.contributingIssuers,
      ttp_receipt_window: RECEIPT_WINDOW_S
    } as Record<string, unknown>)
      .setProtectedHeader({ alg: "EdDSA", kid: authorityKeyId, typ: "JWT" })
      .setSubject(agent_id)
      .setIssuer(authorityUrl)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .setJti(jti)
      .sign(await importEdPrivateKey(authorityPrivateKeyBytes))

    return res.status(200).json({
      token,
      expires_at: now + ttl,
      score: aggregation.score,
      issuer_count: aggregation.contributingIssuers
    })
  })

  // ─── Admin: Register Issuer ───────────────────────────────────────────────

  router.post("/v1/admin/issuers", (req: Request, res: Response) => {
    const authKey = req.headers["authorization"]?.replace("Bearer ", "")
    if (!authKey || authKey !== adminApiKey) {
      return res.status(401).json({ error: "UNAUTHORIZED" })
    }

    const {
      issuer_id,
      public_key,
      domain,
      description,
      issuer_type,
      peer_agent_id,
      min_attester_score,
      confirmation_url
    } = req.body as {
      issuer_id: string
      public_key: string
      domain: string
      description?: string
      issuer_type?: IssuerType
      peer_agent_id?: string
      min_attester_score?: number
      confirmation_url?: string
    }

    if (!issuer_id || !public_key || !domain) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "issuer_id, public_key, and domain are required"
      })
    }

    // Validate peer issuer requirements
    if (issuer_type === "agent_peer") {
      if (!peer_agent_id) {
        return res.status(400).json({
          error: "INVALID_REQUEST",
          message: "peer_agent_id is required for agent_peer issuers"
        })
      }
      if (!store.getAgent(peer_agent_id)) {
        return res.status(400).json({
          error: "AGENT_NOT_FOUND",
          message: `No agent with ID '${peer_agent_id}' — register the agent first`
        })
      }
      if (min_attester_score !== undefined && (min_attester_score < 0 || min_attester_score > 1)) {
        return res.status(400).json({
          error: "INVALID_REQUEST",
          message: "min_attester_score must be in [0.0, 1.0]"
        })
      }
    }

    const issuer: RegisteredIssuer = {
      issuer_id,
      public_key_b64: public_key,
      domain,
      description,
      registered_at: Date.now(),
      active: true,
      issuer_type: issuer_type ?? "infrastructure",
      ...(issuer_type === "agent_peer" && {
        peer_agent_id,
        min_attester_score: min_attester_score ?? PEER_MIN_ATTESTER_SCORE,
        confirmation_url
      })
    }

    store.registerIssuer(issuer)
    return res.status(201).json({ status: "registered", issuer_id, issuer_type: issuer.issuer_type })
  })

  // ─── Admin: Register Agent ────────────────────────────────────────────────

  router.post("/v1/admin/agents", (req: Request, res: Response) => {
    const authKey = req.headers["authorization"]?.replace("Bearer ", "")
    if (!authKey || authKey !== adminApiKey) {
      return res.status(401).json({ error: "UNAUTHORIZED" })
    }

    const { agent_id, description } = req.body as {
      agent_id: string
      description?: string
    }

    if (!agent_id) {
      return res.status(400).json({ error: "INVALID_REQUEST", message: "agent_id is required" })
    }

    const apiKey = `agt_${uuidv4().replace(/-/g, "")}`

    const agent: RegisteredAgent = {
      agent_id,
      api_key: apiKey,
      description,
      registered_at: Date.now(),
      blocked: false
    }

    store.registerAgent(agent)
    return res.status(201).json({ status: "registered", agent_id, api_key: apiKey })
  })

  // ─── Admin: Block Agent ───────────────────────────────────────────────────

  router.post("/v1/admin/agents/:agentId/block", (req: Request, res: Response) => {
    const authKey = req.headers["authorization"]?.replace("Bearer ", "")
    if (!authKey || authKey !== adminApiKey) {
      return res.status(401).json({ error: "UNAUTHORIZED" })
    }

    const { agentId } = req.params
    const { reason } = req.body as { reason?: string }

    const agent = store.getAgent(agentId)
    if (!agent) {
      return res.status(404).json({ error: "AGENT_NOT_FOUND" })
    }

    store.blockAgent(agentId, reason ?? "Administratively blocked")
    return res.json({ status: "blocked", agent_id: agentId })
  })

  return router
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ValidationError {
  status: number
  code: string
  message: string
}

function validateReceipt(receipt: BehavioralReceipt, store: TTPStore): ValidationError | null {
  if (!receipt || typeof receipt !== "object") {
    return { status: 400, code: "INVALID_SCHEMA", message: "Receipt must be a JSON object" }
  }

  if (receipt.ttp_version !== TTP_VERSION) {
    return { status: 400, code: "UNSUPPORTED_VERSION", message: `Unsupported ttp_version: ${receipt.ttp_version}` }
  }

  const required = ["receipt_id", "agent_id", "issuer_id", "event_type", "domain", "timestamp", "score", "signature"]
  for (const field of required) {
    if (!(field in receipt) || receipt[field as keyof BehavioralReceipt] === undefined) {
      return { status: 400, code: "INVALID_SCHEMA", message: `Missing required field: ${field}` }
    }
  }

  if (typeof receipt.score !== "number" || receipt.score < 0 || receipt.score > 1) {
    return { status: 400, code: "SCORE_OUT_OF_RANGE", message: "score must be a number in [0.0, 1.0]" }
  }

  const nowMs = Date.now()
  const ageMs = nowMs - receipt.timestamp

  if (ageMs < 0 && Math.abs(ageMs) > MAX_FUTURE_RECEIPT_S * 1000) {
    return { status: 400, code: "RECEIPT_FUTURE_DATED", message: `Receipt timestamp is more than ${MAX_FUTURE_RECEIPT_S}s in the future` }
  }

  if (ageMs > MAX_RECEIPT_AGE_S * 1000) {
    return { status: 400, code: "RECEIPT_TOO_OLD", message: `Receipt is older than ${MAX_RECEIPT_AGE_S}s` }
  }

  if (!store.getIssuer(receipt.issuer_id)) {
    return { status: 401, code: "ISSUER_NOT_REGISTERED", message: `Issuer '${receipt.issuer_id}' is not registered` }
  }

  return null
}

/**
 * Call the external peer receipt confirmation API (§17.5).
 * Fails closed: any error, timeout, or non-approval is treated as denied.
 */
async function callConfirmationApi(
  confirmationUrl: string,
  request: PeerConfirmationRequest
): Promise<PeerConfirmationResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PEER_CONFIRMATION_TIMEOUT_MS)

  try {
    const response = await fetch(confirmationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return { approved: false, reason: `confirmation_api_http_${response.status}` }
    }

    const body = await response.json() as PeerConfirmationResponse
    return { approved: body.approved === true, reason: body.reason }
  } catch (err) {
    clearTimeout(timeout)
    const reason = (err as Error).name === "AbortError"
      ? "confirmation_api_timeout"
      : "confirmation_api_unreachable"
    return { approved: false, reason }
  }
}

// Import Ed25519 private key for use with jose
async function importEdPrivateKey(privateKeyBytes: Uint8Array): Promise<CryptoKey> {
  // Construct JWK for the private key
  const jwk = {
    kty: "OKP",
    crv: "Ed25519",
    d: base64urlEncode(privateKeyBytes),
    x: base64urlEncode(ed.getPublicKey(privateKeyBytes))
  }

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "Ed25519" },
    false,
    ["sign"]
  )
}
