# TTP Issuer Implementation Guide

This directory contains reference implementations and guidance for building TTP issuers.

## What is an Issuer?

An issuer observes agent behavior and submits cryptographically signed behavioral receipts to the Trust Authority. Issuers are the source of all trust evidence in TTP.

**Core responsibilities:**
1. Observe agent actions in your domain
2. Compute a behavioral score for each observation (see [scoring-semantics.md](../../protocol/scoring-semantics.md))
3. Sign and submit receipts to the Trust Authority

## Available Reference Implementations

| File | Type | Use Case |
|------|------|----------|
| `api-gateway-issuer.ts` | HTTP | Any API gateway or reverse proxy |
| `inference-monitor-issuer.ts` | AI Output | Language model output safety evaluation |

## Building Your Own Issuer

### Checklist

- [ ] Generate a unique Ed25519 keypair for this issuer
- [ ] Register the issuer with your Trust Authority (POST /v1/admin/issuers)
- [ ] Define your scoring model using [scoring-semantics.md](../../protocol/scoring-semantics.md) as a guide
- [ ] Implement async receipt submission (don't block observed actions)
- [ ] Test that signatures verify correctly against test vectors
- [ ] Document your scoring model for operators

### Key Principles

**Never block the observed action.**

Receipt submission is always asynchronous. The agent's action proceeds regardless of whether the receipt was successfully submitted.

**Be consistent across agents.**

Apply identical scoring logic to all agents. Per-agent scoring logic undermines the independence assumption of multi-issuer aggregation.

**Don't include PII in event_data.**

The `event_data` field is visible in audit logs and may be stored by the Trust Authority. Never include customer names, email addresses, or other personally identifiable information.

**Calibrate your score distribution.**

A healthy issuer's scores should not be uniformly 1.0. That removes all signal. Run in observation mode and review score distributions before going live.

### Minimal Issuer Template

```typescript
import { TTPIssuer } from "@blocksifr/ttp-sdk"

const issuer = new TTPIssuer({
  issuerId: "issuer-my-service-01",
  privateKey: process.env.ISSUER_PRIVATE_KEY,
  authorityUrl: process.env.TTP_AUTHORITY_URL,
  authorityApiKey: process.env.ISSUER_API_KEY,
  domain: "my-domain"
})

// In your observation point:
function onAgentAction(agentId: string, action: YourActionType) {
  const score = computeScore(action)
  
  // Non-blocking submission
  issuer.queueReceipt({
    agentId,
    eventType: "my_event_type",
    score,
    eventData: { /* safe, non-PII context */ }
  }).catch(err => console.error("Receipt submission failed:", err))
}
```
