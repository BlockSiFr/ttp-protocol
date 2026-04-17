import http from "node:http"
import { randomUUID } from "node:crypto"
import { AuthorizeRequest, Decision, DecisionContext, ExecutionReceipt } from "./schemas"
import { finalizeReceipt } from "./receiptSigner"
import { isProtectedPath, loadProtectedPolicy } from "./policyLoader"

const receipts = new Map<string, ExecutionReceipt>()
let lastHash: string | null = null

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

function decide(req: AuthorizeRequest, protectedPaths: string[]): { decision: Decision; reason: string; context: DecisionContext } {
  const protectedAction = req.pathsTouched.some(p => isProtectedPath(p, protectedPaths))
  const trustScore = req.trustScore ?? 0.5
  const freshness = req.freshnessSeconds ?? 9999
  const attestationValid = freshness <= 900
  const grantValid = Boolean(req.authorityGrantRef)

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
    req.on("data", c => chunks.push(c))
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

  if (req.method === "POST" && url.pathname === "/trust/attest") {
    return json(res, 200, { status: "accepted", attestationRef: `att-${randomUUID()}` })
  }

  if (req.method === "POST" && url.pathname === "/re/authorize") {
    const body = await parseBody(req) as AuthorizeRequest
    const { decision, reason, context } = decide(body, protectedPaths)

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
      reason
    }

    const receipt = finalizeReceipt(receiptBase, lastHash)
    lastHash = receipt.chainHash
    receipts.set(receipt.receiptId, receipt)

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
    const receipt = receipts.get(id)
    if (!receipt) return json(res, 404, { error: "NOT_FOUND" })
    return json(res, 200, receipt)
  }

  return json(res, 404, { error: "NOT_FOUND" })
})

const port = Number(process.env.PORT ?? "8080")
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[authority] listening on :${port}`)
})
