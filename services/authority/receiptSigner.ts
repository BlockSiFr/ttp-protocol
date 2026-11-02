import crypto from "node:crypto"
import { ExecutionReceipt } from "./schemas"

export function chainHash(previous: string | null, payload: object): string {
  const h = crypto.createHash("sha256")
  h.update(previous ?? "GENESIS")
  h.update(JSON.stringify(payload))
  return `sha256:${h.digest("hex")}`
}

export function signReceipt(receipt: object, signingSecret = process.env.RECEIPT_HMAC_SECRET): string {
  if (!signingSecret || Buffer.byteLength(signingSecret) < 32) {
    throw new Error("RECEIPT_HMAC_SECRET must be an independently provisioned secret of at least 32 bytes")
  }
  const sig = crypto.createHmac("sha256", signingSecret)
  sig.update(JSON.stringify(receipt))
  return `hmac-sha256:${sig.digest("hex")}`
}

export function finalizeReceipt(
  partial: Omit<ExecutionReceipt, "signature" | "chainHash">,
  prevHash: string | null
): ExecutionReceipt {
  const chain = chainHash(prevHash, partial)
  const signature = signReceipt({ ...partial, chainHash: chain })
  return { ...partial, chainHash: chain, signature }
}
