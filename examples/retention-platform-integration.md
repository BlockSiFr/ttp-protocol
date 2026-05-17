# TTP Integration Guide: Autonomous Retention Platform

This guide walks through integrating TTP into an autonomous retention system where AI agents trigger discounts, campaigns, and customer notifications.

## Scenario

You have an AI retention agent that:

1. Monitors customer churn signals
2. Autonomously decides which retention action to take (discount, message, callback scheduling)
3. Executes the action against internal APIs

Without TTP, your internal APIs must trust the agent based on identity alone. With TTP, every action is gated on the agent's current behavioral trust score.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Retention Platform                           │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────────────────┐ │
│  │  Retention Agent │      │    Retention APIs            │ │
│  │                  │      │                              │ │
│  │  • Observes CRM  │      │  POST /api/issue-discount   │ │
│  │  • Decides action│─────►│  POST /api/trigger-campaign │ │
│  │  • Executes via  │      │  POST /api/send-message     │ │
│  │    API calls     │      │                              │ │
│  └────────┬─────────┘      └──────────┬───────────────────┘ │
│           │                           │                      │
│           │ requests token            │ verifies token       │
│           ▼                           ▼                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Trust Authority                            │ │
│  │                                                        │ │
│  │  ◄── API Gateway Issuer (observes agent HTTP calls)   │ │
│  │  ◄── CRM Access Issuer (observes CRM reads/writes)    │ │
│  │  ◄── Safety Monitor Issuer (evaluates AI outputs)     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Configure Trust Thresholds

Define your trust requirements per action type:

```typescript
// retention-api/trust-config.ts
export const TRUST_THRESHOLDS = {
  "issue-discount": {
    domain: "retention",
    minScore: 0.90,        // High: financial action
    minIssuerCount: 2,     // Require 2 independent issuers
    fallback: "deny"       // Never allow without verified trust
  },
  "trigger-campaign": {
    domain: "retention",
    minScore: 0.85,        // Medium-high: broad customer impact
    minIssuerCount: 2,
    fallback: "deny"
  },
  "send-message": {
    domain: "retention",
    minScore: 0.75,        // Medium: single customer communication
    minIssuerCount: 1,
    fallback: "cached"     // Allow up to 2 min past expiry
  },
  "read-customer-data": {
    domain: "retention",
    minScore: 0.60,        // Low: read-only, no customer impact
    minIssuerCount: 1,
    fallback: "cached"
  }
}
```

## Step 2: Add Verifiers to Your API

```typescript
// retention-api/server.ts
import express from "express"
import { createTTPMiddleware, fetchTTPAuthorityKey } from "@blocksifrdev/ttp-sdk"
import { TRUST_THRESHOLDS } from "./trust-config"

const app = express()
const authorityPublicKey = await fetchTTPAuthorityKey(process.env.TTP_AUTHORITY_URL)

// Each endpoint gets its appropriate trust requirement
app.post("/api/issue-discount",
  createTTPMiddleware({ ...TRUST_THRESHOLDS["issue-discount"], authorityPublicKey }),
  async (req, res) => {
    // Only reachable if trust is verified
    await issueDiscount({
      ...req.body,
      authorizedBy: req.ttp!.agentId,
      trustScore: req.ttp!.score
    })
    res.json({ success: true })
  }
)

app.post("/api/trigger-campaign",
  createTTPMiddleware({ ...TRUST_THRESHOLDS["trigger-campaign"], authorityPublicKey }),
  async (req, res) => {
    await triggerCampaign(req.body)
    res.json({ success: true })
  }
)

app.post("/api/send-message",
  createTTPMiddleware({ ...TRUST_THRESHOLDS["send-message"], authorityPublicKey }),
  async (req, res) => {
    await sendMessage(req.body)
    res.json({ success: true })
  }
)
```

## Step 3: Deploy Your Issuers

### Issuer 1: API Gateway (Observes HTTP behavior)

```typescript
// Attach to your API gateway
app.use(createApiGatewayIssuer({
  issuerId: "issuer-gateway-retention",
  privateKey: process.env.ISSUER_PRIVATE_KEY,
  authorityUrl: process.env.TTP_AUTHORITY_URL,
  authorityApiKey: process.env.ISSUER_API_KEY,
  domain: "retention",
  expectedPaths: [/^\/api\//]
}))
```

### Issuer 2: CRM Access Monitor (Observes data access)

```typescript
// Wrap your CRM client
class MonitoredCRMClient {
  private issuer: TTPIssuer
  private inner: CRMClient

  async getCustomer(customerId: string, agentId: string) {
    const result = await this.inner.getCustomer(customerId)
    
    // Score based on data access patterns
    const score = this.scoreDataAccess(customerId, agentId, result)
    
    this.issuer.queueReceipt({
      agentId,
      eventType: "data_access",
      score,
      eventData: {
        resource: "customer",
        operation: "read",
        customer_id: customerId  // No PII in event_data
      }
    })
    
    return result
  }
  
  private scoreDataAccess(customerId: string, agentId: string, result: unknown): number {
    // Normal single-customer read
    if (result) return 0.95
    // Customer not found — unexpected
    return 0.70
  }
}
```

### Issuer 3: Output Safety Monitor (Evaluates agent decisions)

```typescript
// Before executing each retention decision
async function evaluateAndExecute(decision: RetentionDecision, agentId: string) {
  const safetyScore = await safetyCheck(decision)
  
  issuer.queueReceipt({
    agentId,
    eventType: "safety_monitor",
    score: safetyScore,
    eventData: {
      decision_type: decision.type,
      flags: decision.safetyFlags
    }
  })
  
  if (safetyScore < 0.7) {
    throw new Error(`Decision failed safety check (score: ${safetyScore})`)
  }
  
  return executeDecision(decision)
}

async function safetyCheck(decision: RetentionDecision): Promise<number> {
  // Check discount is within allowed bounds
  if (decision.type === "discount" && decision.percent > 50) return 0.10
  // Check message doesn't contain prohibited content
  if (decision.type === "message" && containsProhibitedContent(decision.text)) return 0.05
  // Normal decision
  return 1.0
}
```

## Step 4: Update Your Agent

```typescript
// retention-agent/agent.ts
import { TTPClient } from "@blocksifrdev/ttp-sdk"

const ttp = new TTPClient({
  agentId: process.env.TTP_AGENT_ID,
  apiKey: process.env.TTP_API_KEY,
  authorityUrl: process.env.TTP_AUTHORITY_URL
})

async function executeRetentionAction(action: RetentionAction) {
  // Get trust token (cached after first call)
  const token = await ttp.getTrustToken({ domain: "retention" })
  
  const response = await fetch(`https://retention-api.internal/${action.endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-id": process.env.TTP_AGENT_ID,
      "x-ttp-token": token.value
    },
    body: JSON.stringify(action.payload)
  })
  
  if (response.status === 403) {
    const error = await response.json()
    if (error.reason === "SCORE_BELOW_THRESHOLD") {
      // Trust score is too low — log and skip this action
      console.log(`[Agent] Action blocked: trust score ${error.token_score} < ${error.required_score}`)
      console.log(`[Agent] Waiting for trust to recover through normal operation...`)
      return { blocked: true, reason: "INSUFFICIENT_TRUST" }
    }
  }
  
  return response.json()
}
```

---

## Trust Score Expectations

A well-behaved retention agent should maintain:

| Metric | Expected Range |
|--------|---------------|
| Daily average trust score | 0.85 – 0.98 |
| Score after 24h of normal operation | ≥ 0.90 |
| Score recovery after a minor violation | 6–12 hours |
| Score floor after a serious violation | ~0.50 (requires sustained good behavior to recover) |

## Monitoring

Add these metrics to your observability stack:

```typescript
// Track trust scores over time
app.use(async (req, res, next) => {
  if (req.ttp) {
    metrics.histogram("ttp.token.score", req.ttp.score, {
      domain: req.ttp.domain,
      agent_id: req.ttp.agentId
    })
    metrics.increment("ttp.token.verified", {
      domain: req.ttp.domain
    })
  }
  next()
})

// Alert on low-trust access attempts
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode === 403 && req.headers["x-ttp-token"]) {
      alerts.fire("ttp.access.denied", {
        path: req.path,
        agent_id: req.headers["x-agent-id"]
      })
    }
  })
  next()
})
```
