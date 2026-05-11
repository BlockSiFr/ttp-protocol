import {
  computeBindingHash,
  createExecutionReceipt,
  resolveTrustRoute
} from '../packages/trust-routing-engine/src/index.js'

const timestamp = new Date().toISOString()

function executionRequest(overrides = {}) {
  const base = {
    subject: 'agent://retention-worker',
    action: 'deploy.production',
    resource: 'github:blocksifrdev/ttp-protocol/actions/deploy',
    context: {
      environment: 'production'
    },
    attestationRef: 'att://gateway/recent-behavior',
    requestedBy: 'github-actions',
    paramsHash: 'sha256:deploy-plan-42',
    timestamp,
    delegationHopCount: 0,
    ...overrides
  }

  return {
    ...base,
    bindingHash: computeBindingHash({
      subject: base.subject,
      action: base.action,
      resource: base.resource,
      paramsHash: base.paramsHash,
      timestampBucket: base.timestamp.slice(0, 16)
    })
  }
}

function routeCandidate(overrides = {}) {
  return {
    issuerType: 'behavioral',
    issuerId: 'issuer://ci-runtime',
    proofRef: 'proof://ci-runtime/last-5m',
    trustScore: 0.94,
    lastVerifiedAt: new Date(Date.now() - 30_000).toISOString(),
    freshnessSeconds: 120,
    revoked: false,
    delegationAllowed: true,
    maxHops: 2,
    currentHopCount: 0,
    grantId: 'grant://production-deploy',
    minTrustScore: 0.72,
    requiresStepUp: false,
    action: 'deploy.production',
    environmentConstraints: {
      environment: 'production'
    },
    ...overrides
  }
}

const scenarios = [
  {
    name: 'PERMIT trusted build action',
    request: executionRequest({
      action: 'build.run',
      resource: 'github:blocksifrdev/ttp-protocol/actions/build'
    }),
    candidates: [
      routeCandidate({
        action: 'build.run',
        grantId: 'grant://ci-build',
        requiresStepUp: false
      })
    ]
  },
  {
    name: 'STEP_UP production deploy',
    request: executionRequest(),
    candidates: [
      routeCandidate({
        requiresStepUp: true
      })
    ]
  },
  {
    name: 'DENY revoked workload',
    request: executionRequest({
      subject: 'agent://compromised-worker'
    }),
    candidates: [
      routeCandidate({
        revoked: true
      })
    ]
  }
]

let priorReceiptHash = ''

for (const scenario of scenarios) {
  const decision = resolveTrustRoute({
    request: scenario.request,
    candidates: scenario.candidates
  })
  const receipt = createExecutionReceipt({
    request: scenario.request,
    decision,
    priorReceiptHash
  })
  priorReceiptHash = receipt.chainHash

  console.log(`\n${scenario.name}`)
  console.log(`decision: ${decision.decision}`)
  console.log(`reason: ${decision.reasonCodes.join(', ')}`)
  console.log(`trust: ${decision.trustScoreAtDecision.toFixed(3)} (${decision.trustZone})`)
  console.log(`receipt: ${receipt.receiptId}`)
  console.log(`chain: ${receipt.chainHash.slice(0, 16)}...`)
}
