import crypto from "node:crypto"
import { ExecutionReceipt } from "./schemas"

export function chainHash(previous: string | null, payload: object): string {
  const h = crypto.createHash("sha256")
  h.update(previous ?? "GENESIS")
  h.update(JSON.stringify(payload))
  return `sha256:${h.digest("hex")}`
}

export function signReceipt(receipt: object, signingSecret = "dev-only-secret"): string {
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
