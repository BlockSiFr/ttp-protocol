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
