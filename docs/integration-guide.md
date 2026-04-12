# TTP Integration Guide

This guide walks through integrating TTP into your services and agent infrastructure.

---

## Prerequisites

- A running Trust Authority (self-hosted or managed). See [reference-implementations/trust-authority](../reference-implementations/trust-authority/).
- At least one registered issuer observing your agent.
- The Trust Authority's public key (available at `GET /authority/.well-known/ttp-keys`).

---

## Part 1: Agent Integration

### Step 1 — Install the SDK

```bash
npm install @ttp/sdk
```

### Step 2 — Initialize the Client

```typescript
import { TTPClient } from "@ttp/sdk"

const ttp = new TTPClient({
  agentId: process.env.TTP_AGENT_ID,
  apiKey: process.env.TTP_API_KEY,
  authorityUrl: process.env.TTP_AUTHORITY_URL
})
```

Environment variables:

| Variable | Description |
|----------|-------------|
| `TTP_AGENT_ID` | Your agent's unique identifier |
| `TTP_API_KEY` | API key for authenticating token requests |
| `TTP_AUTHORITY_URL` | Base URL of the Trust Authority |

### Step 3 — Request a Trust Token

```typescript
// Before calling a TTP-protected service
const token = await ttp.getTrustToken({ domain: "retention" })

// Make the protected call
const response = await fetch("https://service.example.com/api/issue-discount", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-TTP-Token": token.value
  },
  body: JSON.stringify({ customerId: "cust_123", discount: 0.10 })
})
```

### Step 4 — Token Auto-Refresh

The SDK handles token caching and auto-refresh automatically:

```typescript
// This is all you need — the client handles the rest
const ttp = new TTPClient({
  agentId: "my-agent",
  apiKey: process.env.TTP_API_KEY,
  authorityUrl: "https://authority.example.com",
  // Optional: configure per-domain defaults
  domains: {
    retention: { minScore: 0.85 },
    financial: { minScore: 0.92 }
  }
})

// getTrustToken() returns a cached token if valid,
// fetches a new one if expired or near-expiry
const token = await ttp.getTrustToken({ domain: "retention" })
```

Token lifecycle:
1. First call: fetch from Trust Authority, cache locally.
2. Subsequent calls within TTL: return cached token (microseconds).
3. When `expires_at - now < 30s`: transparently fetch a new token.
4. On TA unavailability: throw `TTPUnavailableError` (handle with your fallback policy).

---

## Part 2: Service Integration (Verifier)

### Express / Fastify (TypeScript)

```typescript
import express from "express"
import { createTTPMiddleware } from "@ttp/sdk"

const app = express()

// Fetch Trust Authority public key once at startup
const authorityPublicKey = await fetchTTPAuthorityKey(process.env.TTP_AUTHORITY_URL)

// Apply TTP middleware to protected routes
app.use("/api/issue-discount", createTTPMiddleware({
  domain: "retention",
  minScore: 0.85,
  authorityPublicKey,
  // Optional: require minimum issuer count
  minIssuerCount: 2,
  // Optional: enable jti replay detection (recommended for high-stakes endpoints)
  replayDetection: true,
  replayDetectionTtlMs: 300_000
}))

app.post("/api/issue-discount", async (req, res) => {
  // Request only reaches here if TTP verification passed
  // req.ttp is populated with token claims:
  console.log(req.ttp.agentId)     // verified agent ID
  console.log(req.ttp.score)       // verified trust score
  console.log(req.ttp.domain)      // "retention"
  
  await issueDiscount(req.body)
  res.json({ success: true })
})
```

### Manual Verification

If you prefer to verify without the middleware:

```typescript
import { verifyTTPToken } from "@ttp/sdk"

app.post("/api/action", async (req, res) => {
  const token = req.headers["x-ttp-token"]
  
  if (!token) {
    return res.status(401).json({ error: "MISSING_TOKEN" })
  }

  const result = await verifyTTPToken(token as string, {
    domain: "retention",
    minScore: 0.85,
    authorityPublicKey: process.env.TTP_AUTHORITY_PUBLIC_KEY
  })

  if (!result.valid) {
    return res.status(403).json({
      error: "TTP_VERIFICATION_FAILED",
      reason: result.reason,
      ...(result.requiredScore && { requiredScore: result.requiredScore }),
      ...(result.tokenScore !== undefined && { tokenScore: result.tokenScore })
    })
  }

  // Proceed
  await handleAction(req.body)
  res.json({ success: true })
})
```

### Python (FastAPI)

```python
from fastapi import FastAPI, Request, HTTPException, Depends
from ttp_sdk import TTPVerifier

app = FastAPI()
verifier = TTPVerifier(
    authority_url="https://authority.example.com",
    domain="retention",
    min_score=0.85
)

async def require_ttp_trust(request: Request):
    token = request.headers.get("x-ttp-token")
    if not token:
        raise HTTPException(status_code=401, detail="MISSING_TOKEN")
    
    result = await verifier.verify(token)
    if not result.valid:
        raise HTTPException(
            status_code=403,
            detail={"error": "TTP_VERIFICATION_FAILED", "reason": result.reason}
        )
    return result

@app.post("/api/issue-discount")
async def issue_discount(body: dict, trust=Depends(require_ttp_trust)):
    # trust.agent_id, trust.score are available
    return {"success": True}
```

---

## Part 3: Issuer Implementation

An issuer observes agent behavior and submits signed behavioral receipts to the Trust Authority.

### Minimal Issuer (TypeScript)

```typescript
import { TTPIssuer } from "@ttp/sdk"
import express from "express"

const issuer = new TTPIssuer({
  issuerId: "issuer-api-gateway-01",
  privateKey: process.env.TTP_ISSUER_PRIVATE_KEY,
  authorityUrl: "https://authority.example.com",
  authorityApiKey: process.env.TTP_ISSUER_API_KEY,
  domain: "retention"
})

// Attach to Express as logging middleware
app.use(async (req, res, next) => {
  const startTime = Date.now()
  const agentId = req.headers["x-agent-id"] as string
  
  // Let the request proceed
  res.on("finish", async () => {
    if (!agentId) return
    
    const score = scoreRequest(req, res, Date.now() - startTime)
    
    // Submit receipt asynchronously (don't await — don't block the response)
    issuer.submitReceipt({
      agentId,
      eventType: "api_call",
      eventData: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        latencyMs: Date.now() - startTime
      },
      score
    }).catch(err => console.error("Failed to submit receipt:", err))
  })
  
  next()
})

function scoreRequest(req: express.Request, res: express.Response, latencyMs: number): number {
  if (res.statusCode === 403 || res.statusCode === 401) return 0.15
  if (res.statusCode === 429) return 0.35
  if (res.statusCode >= 500) return 0.70
  if (latencyMs > 5000) return 0.75
  if (res.statusCode >= 400) return 0.55
  return 0.95
}
```

See [reference-implementations/issuers](../reference-implementations/issuers/) for a full production-ready issuer.

---

## Part 4: Trust Authority Setup

### Self-Hosted (Docker)

```bash
# Clone the reference implementation
git clone https://github.com/blocksifr/ttp-protocol
cd ttp-protocol/reference-implementations/trust-authority

# Generate keypair
npm run generate-keys
# Output: authority.public.pem, authority.private.pem (guard the private key)

# Configure
cp .env.example .env
# Edit .env: set DATABASE_URL, REDIS_URL, KEY_PATH, etc.

# Start with Docker
docker-compose up -d

# Register an issuer
curl -X POST http://localhost:3000/v1/admin/issuers \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "issuer_id": "issuer-gateway-01",
    "public_key": "base64url-of-ed25519-public-key",
    "domain": "retention",
    "description": "Production API Gateway"
  }'

# Register an agent
curl -X POST http://localhost:3000/v1/admin/agents \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-agent-001",
    "description": "Production retention agent"
  }'
# Response includes the agent API key
```

### Verify Everything is Working

```bash
# Submit a test receipt (as the issuer)
curl -X POST http://localhost:3000/v1/receipts \
  -H "Authorization: Bearer $ISSUER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ttp_version": "1.0",
    "receipt_id": "550e8400-e29b-41d4-a716-446655440000",
    "agent_id": "my-agent-001",
    "issuer_id": "issuer-gateway-01",
    "event_type": "api_call",
    "domain": "retention",
    "timestamp": '"$(date +%s000)"',
    "score": 0.95,
    "signature": "<signed>"
  }'

# Request a token (as the agent)
curl -X POST http://localhost:3000/v1/tokens \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "agent_id": "my-agent-001", "domain": "retention" }'
```

---

## Part 5: Fallback Policies

Configure your verifiers with an explicit fallback policy for Trust Authority unavailability:

```typescript
createTTPMiddleware({
  domain: "retention",
  minScore: 0.85,
  authorityPublicKey,
  
  // Choose one:
  fallback: "deny",     // Reject all requests when TA is unavailable. Fail-closed.
  // fallback: "cached", // Accept tokens up to 5 minutes past expiry.
  // fallback: "degrade" // Accept with a warning header, restrict capabilities.
  
  // For "cached" fallback:
  cachedFallbackMaxAgeMs: 300_000  // Accept expired tokens up to 5 minutes old
})
```

Choose `deny` for high-stakes operations. Choose `cached` when availability is critical and short windows of stale trust are acceptable.

---

## Troubleshooting

### "INSUFFICIENT_TRUST_DATA" when requesting a token

The Trust Authority has no receipts for your agent in the requested domain and receipt window.

**Check:**
1. Is your issuer submitting receipts? Check issuer logs for receipt submission errors.
2. Is the issuer registered with the Trust Authority?
3. Is the issuer submitting to the correct domain?
4. Are receipts recent enough? The receipt window is 300 seconds by default.

### "SCORE_BELOW_THRESHOLD" at the verifier

The agent's current trust score is below the service's minimum requirement.

**Check:**
1. What is the current score? Check `POST /v1/tokens` response.
2. Are there negative-scoring receipts? Check issuer logs.
3. Is the threshold appropriate for the operation?

### Token verification taking too long

**Check:**
1. Are you caching the Trust Authority public key? You should not be fetching it on every request.
2. Are you caching valid tokens? `getTrustToken()` should return cached tokens within milliseconds.

### Clock skew errors

Ensure all systems (agents, issuers, Trust Authority, verifiers) use NTP. A 30-second clock skew tolerance is built in, but larger discrepancies will cause failures.
