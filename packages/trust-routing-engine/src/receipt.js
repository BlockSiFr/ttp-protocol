import crypto from 'node:crypto'

export function createExecutionReceipt({ request, decision, priorReceiptHash = '', signingKey = 'dev-signing-key' }) {
  const timestamp = new Date().toISOString()
  const receiptId = `er-${crypto.randomUUID()}`
  const payload = {
    receiptId,
    subject: request.subject,
    action: request.action,
    resource: request.resource,
    decision: decision.decision,
    trustScoreAtDecision: decision.trustScoreAtDecision,
    trustZone: decision.trustZone,
    authorityGrantRef: decision.authorityGrantRef,
    attestationRef: decision.attestationRef,
    selectedRouteId: decision.selectedPath,
    routeSummary: {
      candidatePathsEvaluated: decision.candidatePathsEvaluated,
      selectedPath: decision.selectedPath
    },
    proofSet: decision.proofSet,
    reasonCodes: decision.reasonCodes,
    evaluationTier: decision.evaluationTier,
    latencyMs: decision.latencyMs,
    timestamp,
    priorReceiptHash
  }

  const chainHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const signature = crypto.createHmac('sha256', signingKey).update(chainHash).digest('hex')

  return {
    ...payload,
    chainHash,
    signature
  }
}
