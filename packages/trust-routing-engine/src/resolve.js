import crypto from 'node:crypto'
import { computeTrustScoreWithDecay, trustZone } from './decay.js'
import { defaultRoutingPolicy, validateRoutingPolicy } from './policy.js'

export function computeBindingHash({ subject, action, resource, paramsHash, timestampBucket }) {
  return `sha256:${crypto.createHash('sha256').update(`${subject}|${action}|${resource}|${paramsHash}|${timestampBucket}`).digest('hex')}`
}

function isEnvironmentValid(constraints = {}, context = {}) {
  return Object.entries(constraints).every(([k, v]) => String(context[k] ?? '') === String(v))
}

/**
 * @param {{request:any,candidates:any[],policy?:any,resolverAvailable?:boolean,proofEngineAvailable?:boolean,latencyBudgetMs?:number,startTimeMs?:number}} input
 */
export function resolveTrustRoute(input) {
  const {
    request,
    candidates,
    policy = defaultRoutingPolicy,
    resolverAvailable = true,
    proofEngineAvailable = true,
    latencyBudgetMs = 50,
    startTimeMs = Date.now()
  } = input

  const p = validateRoutingPolicy(policy)
  const reasonCodes = []
  const bindingCheck = computeBindingHash({
    subject: request.subject,
    action: request.action,
    resource: request.resource,
    paramsHash: request.paramsHash,
    timestampBucket: request.timestamp.slice(0, 16)
  })

  if (!resolverAvailable) return deny('resolver_unavailable')
  if (!proofEngineAvailable && request.context?.proofRequired) return deny('proof_engine_unavailable')
  if (bindingCheck !== request.bindingHash) return deny('binding_mismatch')
  if (!request.paramsHash?.startsWith('sha256:')) return deny('params_hash_mismatch')

  const nowMs = Date.parse(request.timestamp)
  const evaluated = candidates.map(c => {
    const elapsedSeconds = Math.max(0, (nowMs - Date.parse(c.lastVerifiedAt)) / 1000)
    const score = computeTrustScoreWithDecay({ baseScore: c.trustScore, decayConstant: 0.0008, elapsedSeconds, weightedSignals: c.signals ?? [] })
    return {
      ...c,
      evaluatedScore: score,
      zone: trustZone(score),
      freshnessValid: c.freshnessSeconds <= p.maxFreshnessSeconds,
      revoked: Boolean(c.revoked),
      scopeValid: c.action === request.action || c.action === '*',
      environmentValid: isEnvironmentValid(c.environmentConstraints, request.context),
      delegationValid: c.delegationAllowed || (request.delegationHopCount ?? 0) === 0,
      hopsValid: (request.delegationHopCount ?? 0) <= c.maxHops
    }
  })

  if (evaluated.length === 0) return deny('no_valid_route_found')
  if (evaluated.some(e => e.revoked)) return deny('revoked_subject')

  const valid = evaluated.filter(e =>
    e.freshnessValid &&
    e.scopeValid &&
    e.environmentValid &&
    e.delegationValid &&
    e.hopsValid &&
    e.evaluatedScore >= e.minTrustScore
  )

  if (valid.length === 0) return deny('no_valid_route_found')

  let selected
  switch (p.strategy) {
    case 'require_all':
      if (valid.length !== evaluated.length) return deny('require_all_not_satisfied')
      selected = valid.sort((a, b) => b.evaluatedScore - a.evaluatedScore)[0]
      break
    case 'require_any':
      selected = valid.sort((a, b) => b.evaluatedScore - a.evaluatedScore)[0]
      break
    case 'freshest_path_wins':
      selected = valid.sort((a, b) => a.freshnessSeconds - b.freshnessSeconds)[0]
      break
    case 'supervisor_override': {
      const supervisor = valid.find(v => v.issuerType === 'supervisor')
      selected = supervisor ?? valid.sort((a, b) => b.evaluatedScore - a.evaluatedScore)[0]
      break
    }
    case 'domain_hard_deny_overrides_all':
      if (valid.some(v => v.issuerType === 'domain' && v.domainDecision === 'DENY')) return deny('domain_hard_deny')
      selected = valid.sort((a, b) => b.evaluatedScore - a.evaluatedScore)[0]
      break
    case 'strongest_path_wins':
    default:
      selected = valid.sort((a, b) => b.evaluatedScore - a.evaluatedScore)[0]
      break
  }

  const selectedZone = selected.zone
  if (selectedZone === 'critical') return deny('trust_zone_critical')

  let decision = 'PERMIT'
  if (selectedZone === 'warning' || p.stepUpActions.includes(request.action) || selected.requiresStepUp) {
    decision = 'STEP_UP'
    reasonCodes.push('step_up_required')
  }
  if (p.throttleActions.includes(request.action) || selectedZone === 'degraded') {
    decision = decision === 'STEP_UP' ? 'STEP_UP' : 'THROTTLE'
    reasonCodes.push('throttle_required')
  }
  if (p.constrainActions.includes(request.action)) {
    decision = decision === 'PERMIT' ? 'CONSTRAIN' : decision
    reasonCodes.push('constrain_required')
  }

  const latencyMs = Date.now() - startTimeMs
  if (latencyMs > latencyBudgetMs && p.highRiskActions.includes(request.action)) return deny('latency_budget_exceeded')

  return {
    decision,
    selectedPath: `${selected.issuerType}:${selected.issuerId}`,
    candidatePathsEvaluated: evaluated.length,
    trustScoreAtDecision: selected.evaluatedScore,
    trustZone: selectedZone,
    authorityGrantRef: selected.grantId,
    attestationRef: request.attestationRef ?? '',
    proofSet: [selected.proofRef],
    reasonCodes: reasonCodes.length ? reasonCodes : ['route_valid'],
    evaluationTier: latencyMs <= 1 ? 'cache' : latencyMs <= 10 ? 'fast' : 'full',
    latencyMs,
    receiptPayloadPreview: {
      subject: request.subject,
      action: request.action,
      resource: request.resource,
      selectedRouteId: `${selected.issuerType}:${selected.issuerId}`
    }
  }

  function deny(code) {
    return {
      decision: 'DENY',
      selectedPath: null,
      candidatePathsEvaluated: candidates.length,
      trustScoreAtDecision: 0,
      trustZone: 'critical',
      authorityGrantRef: '',
      attestationRef: request.attestationRef ?? '',
      proofSet: [],
      reasonCodes: [code],
      evaluationTier: 'full',
      latencyMs: Date.now() - startTimeMs,
      receiptPayloadPreview: {
        subject: request.subject,
        action: request.action,
        resource: request.resource
      }
    }
  }
}
