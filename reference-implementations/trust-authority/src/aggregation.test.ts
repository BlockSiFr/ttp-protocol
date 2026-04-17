import { aggregateTrustScore } from './aggregation'
import { StoredReceipt, TTP_VERSION } from './types'
import { describe, it, expect } from '@jest/globals'

function r(overrides: Partial<StoredReceipt>): StoredReceipt {
  return {
    ttp_version: TTP_VERSION,
    receipt_id: 'r-1',
    agent_id: 'agent-1',
    issuer_id: 'issuer-1',
    event_type: 'api_call',
    domain: 'retention',
    timestamp: 1_700_000_000_000,
    score: 0.9,
    signature: 'sig',
    accepted_at: 1_700_000_000_000,
    ...overrides
  }
}

describe('aggregateTrustScore', () => {
  it('throws when no receipts in window', () => {
    const now = 1_700_000_500_000
    const receipts = [r({ timestamp: now - 1_000_000 })]
    expect(() => aggregateTrustScore(receipts, now, { receiptWindowS: 300 })).toThrow('INSUFFICIENT_TRUST_DATA')
  })

  it('returns score in [0,1] with receipt metadata', () => {
    const now = 1_700_000_200_000
    const receipts = [
      r({ receipt_id: 'a', issuer_id: 'issuer-a', score: 0.95, timestamp: now - 10_000 }),
      r({ receipt_id: 'b', issuer_id: 'issuer-b', score: 0.85, timestamp: now - 20_000 })
    ]

    const out = aggregateTrustScore(receipts, now)
    expect(out.score).toBeGreaterThanOrEqual(0)
    expect(out.score).toBeLessThanOrEqual(1)
    expect(out.contributingReceipts).toBe(2)
    expect(out.contributingIssuers).toBe(2)
  })

  it('applies issuer weight cap to prevent domination', () => {
    const now = 1_700_000_300_000
    const receipts: StoredReceipt[] = []

    for (let i = 0; i < 30; i++) {
      receipts.push(r({ receipt_id: `dom-${i}`, issuer_id: 'issuer-dominant', score: 0.95, timestamp: now - 1_000 - i }))
    }
    receipts.push(r({ receipt_id: 'independent-1', issuer_id: 'issuer-independent', score: 0.10, timestamp: now - 2_000 }))

    const capped = aggregateTrustScore(receipts, now, { maxIssuerWeight: 0.40 })
    const uncapped = aggregateTrustScore(receipts, now, { maxIssuerWeight: 1.0 })

    expect(capped.score).toBeLessThan(uncapped.score)
  })
})
