export type Decision = "PERMIT" | "DENY" | "STEP_UP" | "ESCALATE" | "THROTTLE" | "CONSTRAIN"
export type DecisionOutcome = "allow" | "deny" | "step-up" | "escalate" | "throttle" | "constrain"
export type TrustZone = "active" | "degraded" | "warning" | "critical"

export interface WorkloadIdentity {
  workloadId: string
  trustScore: number
  decayConstant: number
  riskTier: "low" | "medium" | "high" | "critical"
  lastAttestationAt: string
  allowedRuntimes: string[]
}

export interface AuthorityGrant {
  grantId: string
  subjectId: string
  actions: string[]
  resources: string[]
  minTrustScore: number
  maxFreshnessSeconds: number
  ttlSeconds: number
  requiresStepUp: boolean
  environmentConstraints: Record<string, string>
  routeStrategy: "require_all" | "require_any" | "strongest_path_wins" | "freshest_path_wins" | "supervisor_override" | "domain_hard_deny_overrides_all"
  maxHops: number
  delegationAllowed: boolean
  issuerPrecedence: string[]
  denyOverrides: string[]
}

export interface Attestation {
  attestationId: string
  subjectId: string
  attestationType: "oidc" | "spiffe" | "code_signature" | "behavioral" | "mfa" | "composite"
  issuedAt: string
  expiresAt: string
  signatureValid: boolean
  issuer: string
  claims: Record<string, unknown>
}

export interface TrustAssertionForExecution {
  assertionId: string
  issuerSet: string[]
  subject: string
  audience: string
  scope: string[]
  trustState: {
    score: number
    decayConstant: number
    lastVerifiedAt: string
    zone: TrustZone
  }
  freshness: {
    maxAge: number
    attestationRequired: boolean
    expiresAt?: string
  }
  delegation: {
    allowed: boolean
    maxHops: number
    currentHopCount: number
    parentAssertionId?: string
    transitiveAllowed: boolean
  }
  revocation: {
    status: "active" | "revoked" | "suspended"
    reason?: string
    checkedAt: string
  }
  binding: {
    bindingHash: string
    algorithm: "sha256"
    inputs: {
      subject: string
      action: string
      resource: string
      paramsHash: string
      timestampBucket: string
    }
  }
  proofSet: string[]
  metadata: Record<string, unknown>
}

export interface ExecutionRequest {
  subject: string
  action: string
  resource: string
  context: Record<string, unknown>
  attestationRef?: string
  requestedBy: string
  paramsHash: string
  bindingHash: string
  timestamp: string
  delegationHopCount?: number
}
