import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { resolveTrustRoute, createExecutionReceipt, computeBindingHash, defaultRoutingPolicy } from '../../../packages/trust-routing-engine/src/index.js'

const receipts = new Map()
const revocations = new Map()
const attestations = new Map()
let priorReceiptHash = ''

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function demoCandidates(request) {
  return [
    {
      issuerType: 'behavioral',
      issuerId: 'issuer-behavioral-default',
      proofRef: request.attestationRef ?? 'proof-missing',
      trustScore: Number(request.context?.trustScore ?? 0.9),
      lastVerifiedAt: new Date(Date.now() - 30_000).toISOString(),
      freshnessSeconds: Number(request.context?.freshnessSeconds ?? 120),
      revoked: revocations.get(request.subject)?.status === 'revoked',
      delegationAllowed: true,
      maxHops: 2,
      currentHopCount: Number(request.delegationHopCount ?? 0),
      grantId: `grant-${request.subject}`,
      minTrustScore: 0.65,
      requiresStepUp: request.action === 'deploy.production',
      action: request.action,
      environmentConstraints: request.context?.environment ? { environment: String(request.context.environment) } : {}
    }
  ]
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true })

  if (req.method === 'POST' && url.pathname === '/attestations') {
    const body = await parseBody(req).catch(() => null)
    if (!body?.subject) return json(res, 400, { error: 'INVALID_ATTESTATION' })
    const attestationId = `att-${randomUUID()}`
    attestations.set(attestationId, { ...body, attestationId, createdAt: new Date().toISOString() })
    return json(res, 200, { attestationId })
  }

  if (req.method === 'POST' && url.pathname === '/attestations/verify') {
    const body = await parseBody(req).catch(() => null)
    const att = body?.attestationId ? attestations.get(body.attestationId) : null
    return json(res, 200, { valid: Boolean(att), attestation: att ?? null })
  }

  if (req.method === 'POST' && url.pathname === '/revocations') {
    const body = await parseBody(req).catch(() => null)
    if (!body?.subject) return json(res, 400, { error: 'INVALID_REVOCATION' })
    const record = { status: 'revoked', reason: body.reason ?? 'unspecified', updatedAt: new Date().toISOString() }
    revocations.set(body.subject, record)
    return json(res, 200, { subject: body.subject, ...record })
  }

  if (req.method === 'GET' && url.pathname.startsWith('/revocations/')) {
    const subject = decodeURIComponent(url.pathname.split('/').pop() ?? '')
    return json(res, 200, { subject, ...(revocations.get(subject) ?? { status: 'active' }) })
  }

  if (req.method === 'POST' && url.pathname === '/route/resolve') {
    const body = await parseBody(req).catch(() => null)
    if (!body?.subject || !body?.action || !body?.resource || !body?.paramsHash || !body?.bindingHash || !body?.timestamp) {
      return json(res, 400, { error: 'INVALID_EXECUTION_REQUEST' })
    }

    const decision = resolveTrustRoute({
      request: body,
      candidates: demoCandidates(body),
      policy: defaultRoutingPolicy,
      resolverAvailable: true,
      proofEngineAvailable: true
    })

    return json(res, 200, decision)
  }

  if (req.method === 'POST' && url.pathname === '/re/authorize') {
    const body = await parseBody(req).catch(() => null)
    if (!body?.subject || !body?.action || !body?.resource || !body?.paramsHash || !body?.bindingHash || !body?.timestamp) {
      return json(res, 400, { error: 'INVALID_EXECUTION_REQUEST' })
    }

    const routeDecision = resolveTrustRoute({
      request: body,
      candidates: demoCandidates(body),
      policy: defaultRoutingPolicy,
      resolverAvailable: true,
      proofEngineAvailable: true
    })

    const receipt = createExecutionReceipt({ request: body, decision: routeDecision, priorReceiptHash })
    priorReceiptHash = receipt.chainHash
    receipts.set(receipt.receiptId, receipt)

    return json(res, 200, {
      decision: routeDecision.decision,
      trustScore: routeDecision.trustScoreAtDecision,
      trustZone: routeDecision.trustZone,
      receiptId: receipt.receiptId,
      evaluationTier: routeDecision.evaluationTier,
      latencyMs: routeDecision.latencyMs,
      route: {
        selectedPathId: routeDecision.selectedPath,
        strategy: defaultRoutingPolicy.strategy
      },
      reasonCodes: routeDecision.reasonCodes
    })
  }

  if (req.method === 'GET' && url.pathname.startsWith('/receipts/')) {
    const id = url.pathname.split('/').pop() ?? ''
    const receipt = receipts.get(id)
    if (!receipt) return json(res, 404, { error: 'NOT_FOUND' })
    return json(res, 200, receipt)
  }

  if (req.method === 'GET' && url.pathname === '/receipts') {
    const subject = url.searchParams.get('subject')
    const decision = url.searchParams.get('decision')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    let items = [...receipts.values()]
    if (subject) items = items.filter(i => i.subject === subject)
    if (decision) items = items.filter(i => i.decision === decision)
    if (from) items = items.filter(i => Date.parse(i.timestamp) >= Date.parse(from))
    if (to) items = items.filter(i => Date.parse(i.timestamp) <= Date.parse(to))

    return json(res, 200, { count: items.length, items })
  }

  if (req.method === 'POST' && url.pathname === '/utils/binding-hash') {
    const body = await parseBody(req).catch(() => null)
    if (!body?.subject || !body?.action || !body?.resource || !body?.paramsHash || !body?.timestampBucket) {
      return json(res, 400, { error: 'INVALID_BINDING_REQUEST' })
    }
    return json(res, 200, { bindingHash: computeBindingHash(body) })
  }

  return json(res, 404, { error: 'NOT_FOUND' })
})

const port = Number(process.env.PORT ?? '8090')
server.listen(port, () => {
  console.log(`[trust-route-resolver] listening on :${port}`)
})
