export type Decision = "PERMIT" | "STEP_UP" | "ESCALATE" | "DENY"

export interface AuthorizeRequest {
  subject: string
  action: string
  resource: string
  repo: string
  branch: string
  pathsTouched: string[]
  commitSha: string
  invokingActor: string
  workflowRunId: string
  attestationRef: string
  context: Record<string, unknown>
  authorityGrantRef?: string
  trustScore?: number
  freshnessSeconds?: number
  anomalyScore?: number
  priorReceiptId?: string
  approval?: {
    environment: string
    approved: boolean
    approvedBy: string
  }
}

export interface DecisionContext {
  authority: {
    subjectValid: boolean
    grantValid: boolean
    actionAligned: boolean
    pathConstraintsOk: boolean
    branchConstraintsOk: boolean
    environmentConstraintsOk: boolean
    protectedAction: boolean
  }
  trust: {
    trustScore: number
    attestationValid: boolean
    freshnessSeconds: number
    anomalyScore: number
  }
  risk: {
    class: "low" | "medium" | "high" | "critical"
    blastRadius: number
    reversible: boolean
    delegationDepth: number
    protectedPathSensitive: boolean
  }
  compliance: {
    frameworks: string[]
    controls: string[]
    retentionTier: "standard" | "elevated" | "long_term"
    evidenceRequired: boolean
    humanOversight: "none" | "single" | "dual"
  }
  cost: {
    executionCost: number
    reviewCost: number
    evidenceCost: number
    avoidedLoss: number
    overheadClass: "light" | "standard" | "heavy"
  }
  constraints: string[]
}

export interface ExecutionReceipt {
  receiptId: string
  subject: string
  action: string
  resource: string
  decision: Decision
  trustScoreAtDecision: number
  authorityGrantRef: string
  attestationRef: string
  risk: DecisionContext["risk"]
  compliance: DecisionContext["compliance"]
  cost: DecisionContext["cost"]
  repo: string
  branch: string
  pathsTouched: string[]
  workflowRunId: string
  commitSha: string
  invokingActor: string
  timestamp: string
  signature: string
  chainHash: string
  reason: string
}
