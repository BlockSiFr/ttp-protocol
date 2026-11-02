import http from "node:http"
import { randomUUID, timingSafeEqual } from "node:crypto"
import { AuthorizeRequest, Decision, DecisionContext, ExecutionReceipt } from "./schemas"
import { finalizeReceipt } from "./receiptSigner"
import { isProtectedPath, loadProtectedPolicy } from "./policyLoader"
import { verifyIndependentGithubApproval } from "./approvalVerifier"
import { consumeStepUpReceipt } from "./replayLedger"
import { openReceiptLedger } from "./receiptLedger"

const runtimeToken = process.env.RUNTIME_AUTH_TOKEN
if (!runtimeToken || Buffer.byteLength(runtimeToken) < 32) {
  throw new Error("RUNTIME_AUTH_TOKEN must be configured with at least 32 bytes")
}
if (!process.env.RECEIPT_HMAC_SECRET || Buffer.byteLength(process.env.RECEIPT_HMAC_SECRET) < 32) {
  throw new Error("RECEIPT_HMAC_SECRET must be configured with at least 32 bytes")
}
interface TrustedGrant {
  subject: string
  repo: string
  action: string
  branch?: string
  expiresAt: string
  trustScore: number
  verifiedAt: string
  revoked?: boolean
}
const trustedGrants = JSON.parse(process.env.RUNTIME_AUTH_GRANTS_JSON ?? "{}") as Record<string, TrustedGrant>
function verifiedGrant(req: AuthorizeRequest): TrustedGrant | null {
  const ref = req.authorityGrantRef
  if (!ref || !Object.hasOwn(trustedGrants, ref)) return null
  const grant = trustedGrants[ref]
  const now = Date.now()
  if (!grant || grant.revoked || grant.subject !== req.subject || grant.repo !== req.repo) return null
  if (grant.branch && grant.branch !== req.branch) return null
  if (grant.action !== req.action &&
      !(req.action === "merge request reauthorize" && grant.action === "pull_request.execute")) return null
  if (!Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= now) return null
  if (!Number.isFinite(Date.parse(grant.verifiedAt)) || Date.parse(grant.verifiedAt) > now) return null
  if (!Number.isFinite(grant.trustScore) || grant.trustScore < 0 || grant.trustScore > 1) return null
  return grant
}
function validBearer(header: string | undefined): boolean {
  const input = Buffer.from(header ?? "")
  const expected = Buffer.from(`Bearer ${runtimeToken}`)
  return input.length === expected.length && timingSafeEqual(input, expected)
}
function safeRequest(body: unknown): body is AuthorizeRequest {
  if (!body || typeof body !== "object") return false
  const r = body as Partial<AuthorizeRequest>
  return typeof r.subject === "string" && r.subject.length > 0 &&
    typeof r.action === "string" && typeof r.resource === "string" &&
    typeof r.repo === "string" && typeof r.branch === "string" &&
    typeof r.commitSha === "string" && /^[0-9a-f]{40}$/i.test(r.commitSha) &&
    typeof r.workflowRunId === "string" && /^[0-9]+$/.test(r.workflowRunId) &&
    typeof r.invokingActor === "string" && Array.isArray(r.pathsTouched) &&
    r.pathsTouched.length > 0 && r.pathsTouched.length < 3001 &&
    r.pathsTouched.every(p => typeof p === "string" && p.length > 0 && p.length < 4096) &&
    (r.approval == null || (
      typeof r.approval === "object" &&
      typeof r.approval.approved === "boolean" &&
      typeof r.approval.approvedBy === "string" &&
      r.approval.approvedBy.length > 0 && r.approval.approvedBy.length <= 128 &&
      typeof r.approval.environment === "string"
    ))
}
const receiptLedger = openReceiptLedger()
// Both receipt issuance and post-approval redemption require durable, private storage.

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}

function riskClass(req: AuthorizeRequest, protectedPaths: string[]): DecisionContext["risk"]["class"] {
  if (req.action === "merge approval" || req.action === "release tag request") return "critical"
  if (req.pathsTouched.some(p => isProtectedPath(p, protectedPaths))) return "critical"
  if (["workflow modification request", "policy modification request", "receipt schema modification request", "trust model modification request"].includes(req.action)) return "high"
  if (["pull_request.review", "workflow.dispatch", "merge request"].includes(req.action)) return "medium"
  return "low"
}

async function decide(req: AuthorizeRequest, protectedPaths: string[]): Promise<{ decision: Decision; reason: string; context: DecisionContext }> {
  const protectedAction = req.pathsTouched.some(p => isProtectedPath(p, protectedPaths))
  // Never trust caller-supplied scores or freshness. Resolve the exact grant
  // from operator-provisioned state. Missing/stale/revoked grants fail closed.
  const grant = verifiedGrant(req)
  const trustScore = grant?.trustScore ?? 0
  const freshness = grant ? (Date.now() - Date.parse(grant.verifiedAt)) / 1000 : 9999
  const attestationValid = freshness <= 900
  const grantValid = Boolean(grant)

  const risk = riskClass(req, protectedPaths)

  const context: DecisionContext = {
    authority: {
      subjectValid: Boolean(req.subject),
      grantValid,
      actionAligned: Boolean(req.action && req.resource),
      pathConstraintsOk: true,
      branchConstraintsOk: req.branch !== "",
      environmentConstraintsOk: true,
      protectedAction
    },
    trust: {
      trustScore,
      attestationValid,
      freshnessSeconds: freshness,
      anomalyScore: req.anomalyScore ?? 0
    },
    risk: {
      class: risk,
      blastRadius: risk === "critical" ? 0.95 : risk === "high" ? 0.7 : risk === "medium" ? 0.4 : 0.1,
      reversible: !(risk === "critical"),
      delegationDepth: 0,
      protectedPathSensitive: protectedAction
    },
    compliance: {
      frameworks: ["SOC2", "internal-change-control"],
      controls: ["CC-7.2", "CC-8.1"],
      retentionTier: risk === "critical" ? "long_term" : "elevated",
      evidenceRequired: true,
      humanOversight: risk === "critical" ? "dual" : risk === "high" ? "single" : "none"
    },
    cost: {
      executionCost: risk === "critical" ? 15 : 3,
      reviewCost: risk === "critical" ? 25 : 5,
      evidenceCost: 2,
      avoidedLoss: risk === "critical" ? 50000 : 5000,
      overheadClass: risk === "critical" ? "heavy" : "standard"
    },
    constraints: []
  }

  if (!context.authority.subjectValid || !context.authority.actionAligned || !context.authority.grantValid) {
    return { decision: "DENY", reason: "invalid_authority", context }
  }

  if (req.action === "merge request reauthorize") {
    if (!req.priorReceiptId) {
      return { decision: "DENY", reason: "missing_prior_receipt", context }
    }
    const prior = receiptLedger.get(req.priorReceiptId)
    if (!prior) {
      return { decision: "DENY", reason: "prior_receipt_not_found", context }
    }
    if (!(prior.decision === "STEP_UP" || prior.decision === "ESCALATE")) {
      return { decision: "DENY", reason: "prior_decision_not_reauthorizable", context }
    }
    // Reauthorization can never be transplanted to a different PR, commit,
    // workflow run, branch or changed-file inventory.
    if (prior.subject !== req.subject || prior.repo !== req.repo ||
        prior.branch !== req.branch || prior.resource !== req.resource ||
        prior.workflowRunId !== req.workflowRunId || prior.commitSha !== req.commitSha ||
        prior.action !== "pull_request.execute" ||
        JSON.stringify(prior.pathsTouched) !== JSON.stringify(req.pathsTouched) ||
        !Number.isFinite(Date.parse(prior.timestamp)) ||
        Date.now() - Date.parse(prior.timestamp) > 600_000 ||
        Date.parse(prior.timestamp) > Date.now()) {
      return { decision: "DENY", reason: "prior_receipt_binding_or_freshness_mismatch", context }
    }
    if (!req.approval?.approved || !req.approval.approvedBy ||
        req.approval.environment !== "protected-execution") {
      return { decision: "DENY", reason: "step_up_approval_missing", context }
    }
    // GitHub's independently retrieved review history and current PR identity
    // must corroborate caller claims before issuing any new permit.
    const approvalProof = await verifyIndependentGithubApproval({
      repo: req.repo, workflowRunId: req.workflowRunId,
      commitSha: req.commitSha, branch: req.branch, resource: req.resource,
      invokingActor: req.invokingActor, reviewer: req.approval.approvedBy
    })
    if (!approvalProof.verified) {
      return { decision: "DENY", reason: approvalProof.reason, context }
    }
    if (!context.trust.attestationValid) {
      return { decision: "ESCALATE", reason: "stale_attestation_after_step_up", context }
    }
    // Never acknowledge a new permit until the prior STEP_UP nonce has been
    // spent through the configured, restart-stable single-host atomic ledger.
    const spend = consumeStepUpReceipt(req.priorReceiptId)
    if (!spend.accepted) {
      return { decision: "DENY", reason: spend.reason, context }
    }
    return { decision: "PERMIT", reason: "step_up_approved_reauthorize_permit", context }
  }

  if (!context.trust.attestationValid) {
    return { decision: "ESCALATE", reason: "stale_attestation", context }
  }
  if (risk === "critical") {
    return { decision: "STEP_UP", reason: "protected_action_requires_human", context }
  }
  if (trustScore < 0.85) {
    return { decision: "ESCALATE", reason: "trust_below_threshold", context }
  }

  return { decision: "PERMIT", reason: "policy_permit", context }
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let bytes = 0
    req.on("data", (c: Buffer) => {
      bytes += c.length
      if (bytes > 1_048_576) {
        reject(new Error("REQUEST_TOO_LARGE"))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on("error", reject)
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}"
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  const { protectedPaths } = loadProtectedPolicy()

  if (req.method === "GET" && url.pathname === "/healthz") {
    return json(res, 200, { ok: true })
  }

  if (!validBearer(req.headers.authorization)) {
    return json(res, 401, { error: "UNAUTHORIZED" })
  }

  if (req.method === "POST" && url.pathname === "/trust/attest") {
    return json(res, 200, { status: "accepted", attestationRef: `att-${randomUUID()}` })
  }

  if (req.method === "POST" && url.pathname === "/re/authorize") {
    let body: unknown
    try { body = await parseBody(req) } catch { return json(res, 400, { error: "INVALID_JSON" }) }
    if (!safeRequest(body)) return json(res, 400, { error: "INVALID_REQUEST" })
    const { decision, reason, context } = await decide(body, protectedPaths)

    const receiptBase: Omit<ExecutionReceipt, "signature" | "chainHash"> = {
      receiptId: `er-${randomUUID()}`,
      subject: body.subject,
      action: body.action,
      resource: body.resource,
      decision,
      trustScoreAtDecision: context.trust.trustScore,
      authorityGrantRef: body.authorityGrantRef ?? "",
      attestationRef: body.attestationRef,
      risk: context.risk,
      compliance: context.compliance,
      cost: context.cost,
      repo: body.repo,
      branch: body.branch,
      pathsTouched: body.pathsTouched,
      workflowRunId: body.workflowRunId,
      commitSha: body.commitSha,
      invokingActor: body.invokingActor,
      timestamp: new Date().toISOString(),
      reason,
      priorReceiptId: body.priorReceiptId,
      approvalReviewer: body.approval?.approvedBy
    }

    const receipt = finalizeReceipt(receiptBase, receiptLedger.lastHash())
    // No PERMIT or STEP_UP is acknowledged unless its receipt has been written,
    // chain-verified and fsynced to operator-controlled durable storage.
    try { receiptLedger.append(receipt) }
    catch { return json(res, 503, { error: "DURABLE_RECEIPT_LEDGER_UNAVAILABLE" }) }

    return json(res, 200, {
      decision,
      reason,
      trust: context.trust,
      risk: context.risk,
      compliance: context.compliance,
      cost: context.cost,
      receiptId: receipt.receiptId,
      receipt
    })
  }

  if (req.method === "GET" && url.pathname.startsWith("/receipts/")) {
    const id = url.pathname.split("/").pop() ?? ""
    const receipt = receiptLedger.get(id)
    if (!receipt) return json(res, 404, { error: "NOT_FOUND" })
    return json(res, 200, receipt)
  }

  return json(res, 404, { error: "NOT_FOUND" })
})

const port = Number(process.env.PORT ?? "8080")
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer in the range 1 to 65535")
}
// Safe default: bearer credentials must not traverse an exposed plaintext HTTP
// socket. Terminate TLS at an approved local fronting proxy/sidecar.
server.listen(port, "127.0.0.1", () => {
  console.log(`[authority] local listener on 127.0.0.1:${port}; use approved TLS fronting gateway`)
})
function shutdown(): void {
  server.close(() => {
    try { receiptLedger.close() }
    catch { process.exitCode = 1 }
  })
}
process.once("SIGTERM", shutdown)
process.once("SIGINT", shutdown)
