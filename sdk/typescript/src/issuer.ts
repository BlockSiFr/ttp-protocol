/**
 * TTPIssuer — SDK for implementing TTP issuers.
 *
 * An issuer observes agent behavior, computes behavioral scores,
 * and submits signed receipts to the Trust Authority.
 */

import * as ed from "@noble/ed25519"
import { v4 as uuidv4 } from "uuid"
import {
  IssuerOptions,
  ReceiptSubmissionOptions,
  PeerIssuerOptions,
  PeerReceiptSubmissionOptions,
  TTP_VERSION,
  TTPUnavailableError
} from "./types"

interface BehavioralReceipt {
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

export class TTPIssuer {
  private readonly options: Required<IssuerOptions>
  private readonly privateKeyBytes: Uint8Array
  private pendingQueue: BehavioralReceipt[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: IssuerOptions) {
    this.options = {
      ...options,
      fetch: options.fetch ?? globalThis.fetch
    }
    this.privateKeyBytes = base64urlDecode(options.privateKey)
  }

  /**
   * Submit a behavioral receipt to the Trust Authority.
   *
   * Signing happens synchronously. HTTP submission is async.
   * Errors are thrown as TTPUnavailableError — callers should handle them
   * without blocking the observed agent action.
   */
  async submitReceipt(submission: ReceiptSubmissionOptions): Promise<void> {
    const receipt = await this.buildReceipt(submission)
    await this.sendReceipt(receipt)
  }

  /**
   * Queue a receipt for batched submission.
   * The queue is flushed every 5 seconds or when it reaches 50 receipts.
   * Use this for high-volume issuers to reduce HTTP overhead.
   */
  queueReceipt(submission: ReceiptSubmissionOptions): void {
    this.buildReceipt(submission).then(receipt => {
      this.pendingQueue.push(receipt)
      if (this.pendingQueue.length >= 50) {
        this.flush().catch(err => console.error("[TTPIssuer] Flush error:", err))
      } else if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flush().catch(err => console.error("[TTPIssuer] Flush error:", err))
        }, 5000)
      }
    }).catch(err => console.error("[TTPIssuer] Failed to build receipt:", err))
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    const batch = this.pendingQueue.splice(0)
    if (batch.length === 0) return

    await this.sendBatch(batch)
  }

  private async buildReceipt(submission: ReceiptSubmissionOptions): Promise<BehavioralReceipt> {
    const { agentId, eventType, score, eventData, timestamp = Date.now() } = submission

    if (score < 0 || score > 1) {
      throw new Error(`Invalid score ${score}: must be in [0.0, 1.0]`)
    }

    const receiptWithoutSignature = {
      ttp_version: TTP_VERSION,
      receipt_id: uuidv4(),
      agent_id: agentId,
      issuer_id: this.options.issuerId,
      event_type: eventType,
      ...(eventData !== undefined && { event_data: eventData }),
      domain: this.options.domain,
      timestamp,
      score
    }

    const signature = await signReceipt(receiptWithoutSignature, this.privateKeyBytes)

    return { ...receiptWithoutSignature, signature }
  }

  private async sendReceipt(receipt: BehavioralReceipt): Promise<void> {
    const url = `${this.options.authorityUrl.replace(/\/$/, "")}/v1/receipts`

    let response: Response
    try {
      response = await this.options.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.options.authorityApiKey}`
        },
        body: JSON.stringify(receipt)
      })
    } catch (err) {
      throw new TTPUnavailableError("Failed to submit receipt to Trust Authority", err)
    }

    if (!response.ok && response.status !== 200) {
      // 200 means duplicate — that's fine
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      throw new TTPUnavailableError(
        `Receipt submission failed (${response.status}): ${body.error ?? "Unknown"}`,
        body
      )
    }
  }

  private async sendBatch(receipts: BehavioralReceipt[]): Promise<void> {
    const url = `${this.options.authorityUrl.replace(/\/$/, "")}/v1/receipts/batch`

    let response: Response
    try {
      response = await this.options.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.options.authorityApiKey}`
        },
        body: JSON.stringify({ receipts })
      })
    } catch (err) {
      throw new TTPUnavailableError("Failed to submit receipt batch to Trust Authority", err)
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      console.warn("[TTPIssuer] Batch submission partial failure:", body)
    }
  }
}

// ─── TTPPeerIssuer ────────────────────────────────────────────────────────────

const PEER_DEFAULT_MIN_ATTESTER_SCORE = 0.90

/**
 * TTPPeerIssuer — SDK for agents acting as peer issuers (§17 Agent-as-Issuer).
 *
 * An agent with sufficient trust can submit peer receipts attesting to the
 * behavior of other agents it has directly observed in a shared workflow.
 *
 * The Trust Authority validates that the attesting agent's current trust score
 * meets the minimum threshold before accepting any peer receipt. An optional
 * external confirmation API provides an additional hard gate.
 *
 * Usage:
 * ```typescript
 * const peerIssuer = new TTPPeerIssuer({
 *   issuerId: "agent-a-123",
 *   privateKey: process.env.PEER_ISSUER_PRIVATE_KEY,
 *   authorityUrl: process.env.TTP_AUTHORITY_URL,
 *   ttpClient: myTTPClient,  // agent's own TTPClient
 *   domain: "my-domain"
 * })
 *
 * // After observing Agent B complete a task safely:
 * await peerIssuer.submitPeerReceipt({
 *   agentId: "agent-b-456",
 *   score: 0.93,
 *   observationContext: "pipeline-step-3",
 *   eventData: { behaviors_observed: ["tool_call", "api_request"] }
 * })
 * ```
 */
export class TTPPeerIssuer {
  private readonly options: Required<Omit<PeerIssuerOptions, "minAttesterScore">> & {
    minAttesterScore: number
  }
  private readonly privateKeyBytes: Uint8Array

  constructor(options: PeerIssuerOptions) {
    this.options = {
      ...options,
      fetch: options.fetch ?? globalThis.fetch,
      minAttesterScore: options.minAttesterScore ?? PEER_DEFAULT_MIN_ATTESTER_SCORE
    }
    this.privateKeyBytes = base64urlDecode(options.privateKey)
  }

  /**
   * Submit a peer receipt attesting to another agent's observed behavior.
   *
   * This method:
   * 1. Fetches the attesting agent's current trust token (cached by TTPClient)
   * 2. Checks the attester score meets the minimum (fails fast without a network call)
   * 3. Builds and signs the peer receipt
   * 4. POSTs to /v1/peer-receipts with both the receipt and the attester_token
   *
   * Throws TTPUnavailableError on network failure.
   * Throws Error if the attester's score is below the minimum threshold — this
   * prevents the agent from submitting peer receipts it is not eligible to make.
   */
  async submitPeerReceipt(submission: PeerReceiptSubmissionOptions): Promise<void> {
    const { agentId, score, observationContext, eventData = {}, timestamp = Date.now() } = submission

    // Fetch attester's current trust token (cached internally by TTPClient)
    const token = await this.options.ttpClient.getTrustToken({ domain: this.options.domain })

    if (token.score < this.options.minAttesterScore) {
      throw new Error(
        `Attester score ${token.score} is below the minimum required ${this.options.minAttesterScore} ` +
        `— peer receipts cannot be submitted until trust recovers`
      )
    }

    const receipt = await this.buildPeerReceipt(agentId, score, observationContext, eventData, timestamp)

    await this.sendPeerReceipt(receipt, token.value)
  }

  /**
   * Queue a peer receipt for non-blocking submission.
   * The attester eligibility check is still performed — if the score is too low,
   * the error is logged rather than thrown.
   */
  queuePeerReceipt(submission: PeerReceiptSubmissionOptions): void {
    this.submitPeerReceipt(submission).catch(err => {
      console.error("[TTPPeerIssuer] Peer receipt submission failed:", err)
    })
  }

  private async buildPeerReceipt(
    agentId: string,
    score: number,
    observationContext: string | undefined,
    eventData: Record<string, unknown>,
    timestamp: number
  ): Promise<BehavioralReceipt> {
    if (score < 0 || score > 1) {
      throw new Error(`Invalid score ${score}: must be in [0.0, 1.0]`)
    }

    const mergedEventData: Record<string, unknown> = {
      ...eventData,
      ...(observationContext !== undefined && { observation_context: observationContext })
    }

    const receiptWithoutSignature = {
      ttp_version: TTP_VERSION,
      receipt_id: uuidv4(),
      agent_id: agentId,
      issuer_id: this.options.issuerId,
      event_type: "agent_peer_observation",
      event_data: mergedEventData,
      domain: this.options.domain,
      timestamp,
      score
    }

    const signature = await signReceipt(receiptWithoutSignature, this.privateKeyBytes)
    return { ...receiptWithoutSignature, signature }
  }

  private async sendPeerReceipt(receipt: BehavioralReceipt, attesterToken: string): Promise<void> {
    const url = `${this.options.authorityUrl.replace(/\/$/, "")}/v1/peer-receipts`

    let response: Response
    try {
      response = await this.options.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt, attester_token: attesterToken })
      })
    } catch (err) {
      throw new TTPUnavailableError("Failed to submit peer receipt to Trust Authority", err)
    }

    if (!response.ok && response.status !== 200) {
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      throw new TTPUnavailableError(
        `Peer receipt submission failed (${response.status}): ${body.error ?? "Unknown"}`,
        body
      )
    }
  }
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function signReceipt(
  receipt: Omit<BehavioralReceipt, "signature">,
  privateKeyBytes: Uint8Array
): Promise<string> {
  const ordered: Record<string, unknown> = {}
  for (const key of Object.keys(receipt).sort()) {
    ordered[key] = (receipt as Record<string, unknown>)[key]
  }
  const payload = new TextEncoder().encode(JSON.stringify(ordered))
  const signature = await ed.signAsync(payload, privateKeyBytes)
  return base64urlEncode(signature)
}

function base64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/")
  const padding = (4 - (padded.length % 4)) % 4
  return new Uint8Array(Buffer.from(padded + "=".repeat(padding), "base64"))
}
