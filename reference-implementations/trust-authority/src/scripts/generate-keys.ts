/**
 * Generate Ed25519 keypair for the Trust Authority.
 * Run: npm run generate-keys
 */

import * as ed from "@noble/ed25519"
import { sha512 } from "@noble/hashes/sha512"
import * as fs from "fs"
import * as path from "path"

ed.etc.sha512Sync = (message) => sha512(message)

function base64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

async function main() {
  const privateKeyBytes = ed.utils.randomPrivateKey()
  const publicKeyBytes = ed.getPublicKey(privateKeyBytes)

  const privateKey = base64urlEncode(privateKeyBytes)
  const publicKey = base64urlEncode(publicKeyBytes)
  const keyId = `authority-key-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`

  console.log("\n=== TTP Trust Authority Keypair ===\n")
  console.log(`Key ID:      ${keyId}`)
  console.log(`Public Key:  ${publicKey}`)
  console.log(`\n!!! KEEP THE PRIVATE KEY SECRET !!!`)
  console.log(`Private Key: ${privateKey}`)

  // Write .env file
  const envPath = path.join(__dirname, "../../.env")
  const envContent = `# TTP Trust Authority Configuration
# Generated: ${new Date().toISOString()}

PORT=3000
AUTHORITY_URL=http://localhost:3000
AUTHORITY_KEY_ID=${keyId}
AUTHORITY_PRIVATE_KEY=${privateKey}
AUTHORITY_PUBLIC_KEY=${publicKey}
ADMIN_API_KEY=admin-${base64urlEncode(ed.utils.randomPrivateKey()).slice(0, 24)}
NODE_ENV=development
`

  fs.writeFileSync(envPath, envContent)
  console.log(`\n.env file written to: ${envPath}`)
  console.log("\nAdd the public key to your verifiers:")
  console.log(`AUTHORITY_PUBLIC_KEY=${publicKey}`)
  console.log("\nShare the well-known URL with verifiers:")
  console.log("GET http://localhost:3000/.well-known/ttp-keys")
}

main().catch(console.error)
