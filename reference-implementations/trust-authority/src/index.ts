/**
 * TTP Reference Trust Authority
 *
 * Start with:
 *   npm run dev
 *
 * Or generate keys first:
 *   npm run generate-keys
 *   npm run dev
 *
 * Environment variables:
 *   PORT                  (default: 3000)
 *   AUTHORITY_URL         (default: http://localhost:3000)
 *   AUTHORITY_KEY_ID      (default: authority-key-1)
 *   AUTHORITY_PRIVATE_KEY base64url-encoded Ed25519 private key
 *   AUTHORITY_PUBLIC_KEY  base64url-encoded Ed25519 public key
 *   ADMIN_API_KEY         Secret for admin endpoints (default: dev-admin-key)
 */

import express from "express"
import * as ed from "@noble/ed25519"
import { sha512 } from "@noble/hashes/sha512"
import { TTPStore } from "./store"
import { createRouter } from "./routes"
import { base64urlDecode, base64urlEncode } from "./crypto"

// Configure @noble/ed25519 to use SHA-512
ed.etc.sha512Sync = (message) => sha512(message)

async function main() {
  const PORT = parseInt(process.env.PORT ?? "3000")
  const AUTHORITY_URL = process.env.AUTHORITY_URL ?? `http://localhost:${PORT}`
  const AUTHORITY_KEY_ID = process.env.AUTHORITY_KEY_ID ?? "authority-key-1"
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "dev-admin-key"

  // Load or generate keypair
  let privateKeyBytes: Uint8Array
  let publicKeyBytes: Uint8Array

  if (process.env.AUTHORITY_PRIVATE_KEY && process.env.AUTHORITY_PUBLIC_KEY) {
    privateKeyBytes = base64urlDecode(process.env.AUTHORITY_PRIVATE_KEY)
    publicKeyBytes = base64urlDecode(process.env.AUTHORITY_PUBLIC_KEY)
    console.log(`[TTP Authority] Loaded keypair, kid=${AUTHORITY_KEY_ID}`)
  } else {
    console.warn("[TTP Authority] No keypair configured — generating ephemeral keys (DEV ONLY)")
    console.warn("[TTP Authority] Run 'npm run generate-keys' to create persistent keys")
    privateKeyBytes = ed.utils.randomPrivateKey()
    publicKeyBytes = ed.getPublicKey(privateKeyBytes)
    console.log(`[TTP Authority] Generated ephemeral keypair`)
    console.log(`[TTP Authority] Public key: ${base64urlEncode(publicKeyBytes)}`)
  }

  // Initialize store
  const store = new TTPStore()

  // Register the built-in provisioned trust issuer (§18).
  // This is a Trust Authority-internal issuer used for operator-assigned baseline trust.
  // It uses the authority's own public key — provisioned receipts are TA-authoritative.
  store.registerIssuer({
    issuer_id: "ttp-authority-provisioned",
    public_key_b64: base64urlEncode(publicKeyBytes),
    domain: "*",   // wildcard: provisioned trust can apply to any domain
    description: "Built-in Trust Authority provisioned trust issuer (§18)",
    registered_at: Date.now(),
    active: true,
    issuer_type: "infrastructure"
  })

  // Seed with a test issuer and agent in development
  if (process.env.NODE_ENV !== "production") {
    const testIssuerPrivKey = ed.utils.randomPrivateKey()
    const testIssuerPubKey = ed.getPublicKey(testIssuerPrivKey)
    store.registerIssuer({
      issuer_id: "issuer-dev-01",
      public_key_b64: base64urlEncode(testIssuerPubKey),
      domain: "retention",
      description: "Dev issuer",
      registered_at: Date.now(),
      active: true,
      issuer_type: "infrastructure"
    })
    store.registerAgent({
      agent_id: "agent-dev-001",
      api_key: "dev-agent-key",
      description: "Dev agent",
      registered_at: Date.now(),
      blocked: false
    })
    console.log("[TTP Authority] Dev mode: seeded issuer 'issuer-dev-01' and agent 'agent-dev-001'")
    console.log("[TTP Authority] Dev issuer private key:", base64urlEncode(testIssuerPrivKey))
  }

  // Create Express app
  const app = express()
  app.use(express.json())

  // Request logging
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })

  // Mount routes
  const router = createRouter(
    store,
    privateKeyBytes,
    publicKeyBytes,
    AUTHORITY_KEY_ID,
    AUTHORITY_URL,
    ADMIN_API_KEY
  )
  app.use(router)

  // Health check
  app.get("/health", (_req, res) => res.json({ status: "ok", version: "1.0" }))

  // Periodic store pruning (every 5 minutes)
  setInterval(() => {
    store.pruneOldReceipts(86400 * 1000)
  }, 5 * 60 * 1000)

  app.listen(PORT, () => {
    console.log(`\n[TTP Authority] Running at ${AUTHORITY_URL}`)
    console.log(`[TTP Authority] Public key endpoint: ${AUTHORITY_URL}/.well-known/ttp-keys`)
    console.log(`[TTP Authority] Admin API key: ${ADMIN_API_KEY}`)
    console.log(`\nEndpoints:`)
    console.log(`  POST ${AUTHORITY_URL}/v1/receipts         — Submit receipt`)
    console.log(`  POST ${AUTHORITY_URL}/v1/receipts/batch   — Batch submit receipts`)
    console.log(`  POST ${AUTHORITY_URL}/v1/tokens           — Request trust token`)
    console.log(`  GET  ${AUTHORITY_URL}/.well-known/ttp-keys — Public key`)
    console.log(`  POST ${AUTHORITY_URL}/v1/admin/issuers                       — Register issuer`)
    console.log(`  POST ${AUTHORITY_URL}/v1/admin/agents                        — Register agent`)
    console.log(`  GET  ${AUTHORITY_URL}/v1/admin/agents/:id/status             — Agent status`)
    console.log(`  POST ${AUTHORITY_URL}/v1/admin/agents/:id/quarantine         — Quarantine agent`)
    console.log(`  POST ${AUTHORITY_URL}/v1/admin/agents/:id/lift-quarantine    — Lift quarantine`)
    console.log(`  POST ${AUTHORITY_URL}/v1/admin/agents/:id/provision-trust    — Provision trust`)
  })
}

main().catch(err => {
  console.error("[TTP Authority] Fatal error:", err)
  process.exit(1)
})
