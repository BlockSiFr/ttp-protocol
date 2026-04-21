#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const [, , requestPath, responsePath] = process.argv

if (!requestPath || !responsePath) {
  console.error('usage: ttp-local-authorize.mjs <request.json> <response.json>')
  process.exit(2)
}

const receiptsRoot = process.env.TTP_RECEIPTS_DIR || '.ttp/receipts'
const receiptsLogPath = process.env.TTP_RECEIPTS_LOG || path.join(receiptsRoot, 'receipts.ndjson')
const protectedPathsPolicyPath = process.env.TTP_PROTECTED_PATHS_FILE || 'policy/protected-actions.yaml'

const defaultProtectedPathRules = [
  'policy',
  'policy/**',
  '.github/workflows/**',
  'receipts/schemas/**',
  'services/authority/**',
  'protocol/**',
  'reference-implementations/trust-authority/src/crypto.ts',
  'reference-implementations/trust-authority/src/index.ts',
  'reference-implementations/trust-authority/src/routes.ts',
  'reference-implementations/trust-authority/src/store.ts',
  'reference-implementations/trust-authority/src/scripts/**',
  'ttp-language',
  'ttp-language.md'
]

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function appendReceipt(receipt) {
  ensureDir(path.dirname(receiptsLogPath))
  fs.appendFileSync(receiptsLogPath, `${JSON.stringify(receipt)}\n`, 'utf8')

  ensureDir(receiptsRoot)
  fs.writeFileSync(path.join(receiptsRoot, `${receipt.receiptId}.json`), JSON.stringify(receipt, null, 2), 'utf8')
}

function loadProtectedPathRules(policyPath) {
  try {
    const content = fs.readFileSync(policyPath, 'utf8')
    const lines = content.split('\n')
    const rules = []
    let inProtectedPaths = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      if (/^protected_paths\s*:/.test(trimmed)) {
        inProtectedPaths = true
        continue
      }

      if (inProtectedPaths && /^[A-Za-z_]+\s*:/.test(trimmed) && !trimmed.startsWith('- ')) {
        break
      }

      if (inProtectedPaths && trimmed.startsWith('- ')) {
        rules.push(trimmed.slice(2).trim())
      }
    }

    return rules.length > 0 ? rules : defaultProtectedPathRules
  } catch {
    return defaultProtectedPathRules
  }
}

function wildcardToRegExp(rule) {
  const escaped = rule
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')
  return new RegExp(`^${escaped}$`)
}

function isProtectedPath(filePath, rules) {
  return rules.some((rule) => {
    if (rule === filePath) return true
    if (!rule.includes('*')) {
      return filePath === rule || filePath.startsWith(`${rule}/`)
    }

    return wildcardToRegExp(rule).test(filePath)
  })
}

function decide(req) {
  const trustScore = Number.isFinite(req.trustScore) ? req.trustScore : 0.5
  const freshnessSeconds = Number.isFinite(req.freshnessSeconds) ? req.freshnessSeconds : 9999
  const pathsTouched = Array.isArray(req.pathsTouched) ? req.pathsTouched : []
  const protectedPathRules = loadProtectedPathRules(protectedPathsPolicyPath)
  const protectedAction = pathsTouched.some((p) => isProtectedPath(p, protectedPathRules))

  if (!req.subject || !req.action || !req.resource || !req.repo || !req.branch || !req.commitSha || !req.workflowRunId) {
    return { decision: 'DENY', reason: 'invalid_request_missing_required_fields', trustScore, freshnessSeconds, protectedAction }
  }

  if (req.action === 'merge request reauthorize') {
    if (!req.priorReceiptId) {
      return { decision: 'DENY', reason: 'missing_prior_receipt', trustScore, freshnessSeconds, protectedAction }
    }
    if (!req.approval || req.approval.approved !== true || !req.approval.approvedBy) {
      return { decision: 'DENY', reason: 'step_up_approval_missing', trustScore, freshnessSeconds, protectedAction }
    }
    if (freshnessSeconds > 900) {
      return { decision: 'ESCALATE', reason: 'stale_attestation_after_step_up', trustScore, freshnessSeconds, protectedAction }
    }
    return { decision: 'PERMIT', reason: 'step_up_approved_reauthorize_permit', trustScore, freshnessSeconds, protectedAction }
  }

  if (freshnessSeconds > 900) {
    return { decision: 'ESCALATE', reason: 'stale_attestation', trustScore, freshnessSeconds, protectedAction }
  }

  if (protectedAction) {
    return { decision: 'STEP_UP', reason: 'protected_action_requires_human', trustScore, freshnessSeconds, protectedAction }
  }

  if (trustScore < 0.85) {
    return { decision: 'ESCALATE', reason: 'trust_below_threshold', trustScore, freshnessSeconds, protectedAction }
  }

  return { decision: 'PERMIT', reason: 'policy_permit', trustScore, freshnessSeconds, protectedAction }
}

const request = readJson(requestPath)
const evaluation = decide(request)

const receiptId = `er-${crypto.randomUUID()}`
const payloadForHash = {
  receiptId,
  subject: request.subject,
  action: request.action,
  resource: request.resource,
  decision: evaluation.decision,
  reason: evaluation.reason,
  timestamp: new Date().toISOString(),
  repo: request.repo,
  branch: request.branch,
  pathsTouched: Array.isArray(request.pathsTouched) ? request.pathsTouched : [],
  commitSha: request.commitSha,
  workflowRunId: request.workflowRunId,
  invokingActor: request.invokingActor,
  trustScoreAtDecision: evaluation.trustScore
}

const chainHash = crypto.createHash('sha256').update(JSON.stringify(payloadForHash)).digest('hex')
const signature = crypto.createHmac('sha256', process.env.TTP_LOCAL_SIGNING_KEY || 'ttp-local-dev-signing-key').update(chainHash).digest('hex')

const receipt = {
  ...payloadForHash,
  attestationRef: request.attestationRef || '',
  authorityGrantRef: request.authorityGrantRef || '',
  freshnessSecondsAtDecision: evaluation.freshnessSeconds,
  protectedAction: evaluation.protectedAction,
  signature,
  chainHash
}

appendReceipt(receipt)

const response = {
  decision: evaluation.decision,
  receiptId,
  reason: evaluation.reason,
  receipt
}

fs.writeFileSync(responsePath, JSON.stringify(response, null, 2), 'utf8')
