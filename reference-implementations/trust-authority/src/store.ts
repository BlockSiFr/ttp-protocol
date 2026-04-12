/**
 * TTP Trust Authority — In-Memory Store
 *
 * This is a reference implementation using in-memory storage.
 * Production deployments MUST use persistent storage (PostgreSQL, DynamoDB)
 * and a distributed cache (Redis) for deduplication.
 *
 * See docs/architecture.md for production storage recommendations.
 */

import {
  StoredReceipt,
  RegisteredIssuer,
  RegisteredAgent
} from "./types"

export class TTPStore {
  // Receipt storage: agent_id -> domain -> receipts
  private receipts = new Map<string, StoredReceipt[]>()

  // Deduplication: receipt_id -> accepted_at (in-memory; use Redis in production)
  private seenReceiptIds = new Map<string, number>()

  // Registered issuers
  private issuers = new Map<string, RegisteredIssuer>()

  // Registered agents
  private agents = new Map<string, RegisteredAgent>()

  // -------------------------
  // Issuer management
  // -------------------------

  registerIssuer(issuer: RegisteredIssuer): void {
    this.issuers.set(issuer.issuer_id, issuer)
  }

  getIssuer(issuerId: string): RegisteredIssuer | undefined {
    return this.issuers.get(issuerId)
  }

  listIssuers(): RegisteredIssuer[] {
    return Array.from(this.issuers.values())
  }

  // -------------------------
  // Agent management
  // -------------------------

  registerAgent(agent: RegisteredAgent): void {
    this.agents.set(agent.agent_id, agent)
  }

  getAgent(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId)
  }

  blockAgent(agentId: string, reason: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.blocked = true
      agent.blocked_reason = reason
    }
  }

  // -------------------------
  // Receipt storage
  // -------------------------

  isReceiptDuplicate(receiptId: string): boolean {
    return this.seenReceiptIds.has(receiptId)
  }

  storeReceipt(receipt: StoredReceipt): void {
    this.seenReceiptIds.set(receipt.receipt_id, receipt.accepted_at)

    const key = `${receipt.agent_id}:${receipt.domain}`
    const existing = this.receipts.get(key) ?? []
    existing.push(receipt)
    this.receipts.set(key, existing)
  }

  getReceipts(agentId: string, domain: string): StoredReceipt[] {
    const key = `${agentId}:${domain}`
    return this.receipts.get(key) ?? []
  }

  /**
   * Prune receipts older than maxAgeMs to prevent unbounded memory growth.
   * In production this is handled by database TTL policies.
   */
  pruneOldReceipts(maxAgeMs: number): void {
    const now = Date.now()
    for (const [key, receipts] of this.receipts.entries()) {
      const fresh = receipts.filter(r => (now - r.timestamp) <= maxAgeMs)
      if (fresh.length === 0) {
        this.receipts.delete(key)
      } else {
        this.receipts.set(key, fresh)
      }
    }
    // Also prune seen receipt IDs
    for (const [id, acceptedAt] of this.seenReceiptIds.entries()) {
      if ((now - acceptedAt) > maxAgeMs) {
        this.seenReceiptIds.delete(id)
      }
    }
  }
}
