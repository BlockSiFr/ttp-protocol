/**
 * TTP Cryptographic Utilities
 *
 * All signatures use Ed25519 as specified in RFC 8037.
 * JWT tokens use the EdDSA algorithm identifier.
 */

import * as ed from "@noble/ed25519"
import { sha512 } from "@noble/hashes/sha512"
import { BehavioralReceipt } from "./types"

// Configure @noble/ed25519 to use SHA-512 (required for Ed25519)
ed.etc.sha512Sync = (...m) => sha512(...m)

/**
 * Compute the canonical signing payload for a receipt.
 *
 * The canonical form is: JSON object with all fields except 'signature',
 * keys sorted lexicographically, no extra whitespace.
 */
export function receiptCanonicalPayload(receipt: Omit<BehavioralReceipt, "signature">): Uint8Array {
  const ordered: Record<string, unknown> = {}
  const keys = Object.keys(receipt).sort()
  for (const key of keys) {
    ordered[key] = (receipt as Record<string, unknown>)[key]
  }
  return new TextEncoder().encode(JSON.stringify(ordered))
}

/**
 * Sign a receipt payload with an Ed25519 private key.
 * Returns the base64url-encoded signature.
 */
export function signReceipt(
  receipt: Omit<BehavioralReceipt, "signature">,
  privateKeyBytes: Uint8Array
): string {
  const payload = receiptCanonicalPayload(receipt)
  const signature = ed.sign(payload, privateKeyBytes)
  return base64urlEncode(signature)
}

/**
 * Verify a receipt's Ed25519 signature.
 * Returns true if valid, false if invalid.
 */
export function verifyReceiptSignature(
  receipt: BehavioralReceipt,
  publicKeyBytes: Uint8Array
): boolean {
  try {
    const { signature, ...rest } = receipt
    const payload = receiptCanonicalPayload(rest)
    const signatureBytes = base64urlDecode(signature)
    return ed.verify(signatureBytes, payload, publicKeyBytes)
  } catch {
    return false
  }
}

/**
 * Generate a new Ed25519 keypair.
 * Returns { privateKey, publicKey } as base64url-encoded strings.
 */
export async function generateKeypair(): Promise<{
  privateKey: string
  publicKey: string
  privateKeyBytes: Uint8Array
  publicKeyBytes: Uint8Array
}> {
  const privateKeyBytes = ed.utils.randomPrivateKey()
  const publicKeyBytes = ed.getPublicKey(privateKeyBytes)
  return {
    privateKey: base64urlEncode(privateKeyBytes),
    publicKey: base64urlEncode(publicKeyBytes),
    privateKeyBytes,
    publicKeyBytes
  }
}

// --- Base64url utilities ---

export function base64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

export function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/")
  const padding = (4 - (padded.length % 4)) % 4
  return new Uint8Array(Buffer.from(padded + "=".repeat(padding), "base64"))
}
