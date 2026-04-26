import http from 'node:http';
import crypto from 'node:crypto';
import { loadReceipts, saveReceipts, storeMetadata } from './storage.mjs';
import { signHash, signingMetadata } from './signing.mjs';

const PORT = process.env.PORT || 8080;
const grants = new Map();
const receipts = loadReceipts();

const seedGrant = {
  grantId: 'grant-local-001',
  expiresAt: '2030-01-01T00:00:00Z',
  scope: ['github.workflow.run:org/repo', 'pipeline.deploy:prod', 'tool.invoke:delete_production_secret']
};
grants.set(seedGrant.grantId, seedGrant);

function normalizeUrl(req) {
  return new URL(req.url, `http://${req.headers.host || 'localhost'}`);
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function computeRisk(request) {
  const environment = String(request.context?.environment ?? 'OTHER').toUpperCase();
  const action = String(request.action ?? '').toLowerCase();
  const agentType = String(request.context?.agentType ?? 'basic').toLowerCase();
  const riskFactors = [];

  if (environment === 'PROD') riskFactors.push('production_environment');
  if (action.includes('deploy') || action.includes('terraform') || action.includes('delete')) riskFactors.push('infrastructure_or_mutation_action');
  if (action.includes('secret') || action.includes('credential')) riskFactors.push('secrets_proximity');
  if (agentType === 'mythos') riskFactors.push('mythos_high_capability_actor');

  let riskScore = 0.2 + riskFactors.length * 0.18;
  riskScore = Math.min(1, Number(riskScore.toFixed(2)));

  let riskLevel = 'LOW';
  if (riskScore >= 0.75) riskLevel = 'CRITICAL';
  else if (riskScore >= 0.55) riskLevel = 'HIGH';
  else if (riskScore >= 0.35) riskLevel = 'MODERATE';

  const blastRadius = riskFactors.includes('production_environment') ? 'ENVIRONMENT' : 'SINGLE_RESOURCE';
  return { riskScore, riskLevel, blastRadius, riskFactors };
}

function computeCost(request) {
  const estimatedTokens = Number(request.context?.estimatedTokens ?? 0);
  const estimatedComputeSeconds = Number(request.context?.estimatedComputeSeconds ?? 0);
  const estimatedCost = Number((estimatedTokens / 100000 + estimatedComputeSeconds * 0.002).toFixed(4));
  const costCenter = request.context?.costCenter ?? 'unknown';

  let budgetDecision = 'WITHIN_BUDGET';
  if (costCenter === 'unknown' && estimatedCost > 1) budgetDecision = 'REQUIRES_APPROVAL';
  if (estimatedCost > 5) budgetDecision = 'OVER_BUDGET';

  return {
    estimatedCost,
    actualCost: 0,
    costUnit: 'USD',
    estimatedTokens,
    estimatedComputeSeconds,
    budgetPolicyRef: 'default-budget-policy-v1',
    budgetDecision,
    quotaImpact: estimatedTokens > 200000 ? 'HIGH' : estimatedTokens > 50000 ? 'MODERATE' : 'LOW',
    rateLimitImpact: 'LOW',
    costCenter,
    owner: request.context?.owner ?? request.principal?.id ?? request.subject ?? 'unknown'
  };
}

function computeCompliance(request, risk) {
  const classification = request.context?.dataClassification ?? 'internal';
  const frameworkApplicability = [
    { framework: 'NIST', status: 'APPLIES' },
    { framework: 'SOC2', status: 'APPLIES' }
  ];

  if (classification === 'regulated') {
    frameworkApplicability.push({ framework: 'PCI_DSS', status: 'CONDITIONAL' });
    frameworkApplicability.push({ framework: 'EU_AI_ACT', status: 'CONDITIONAL' });
  }

  return {
    policySetVersion: 'policy-v1',
    frameworkApplicability,
    frameworkEvaluations: [],
    controlResults: [],
    obligationsTriggered: risk.riskLevel === 'CRITICAL' ? ['require-human-approval'] : [],
    approvalsRequired: risk.riskLevel === 'CRITICAL' ? ['security-approver'] : [],
    compensatingControls: [],
    residualGaps: [],
    retentionClass: classification === 'regulated' ? 'REGULATED' : 'STANDARD',
    jurisdictionConstraints: request.context?.jurisdiction ? [request.context.jurisdiction] : [],
    dataClassification: classification,
    exceptionRefs: [],
    auditTags: ['runtime-authority', 'trust-before-execution']
  };
}

function mapToRap(decision, mode) {
  if (decision === 'PERMIT' && mode === 'FULL') return { rapDecision: 'allow', nextStep: 'execute' };
  if (decision === 'PERMIT' && mode === 'CONSTRAINED') return { rapDecision: 'throttle', nextStep: 'execute_constrained' };
  if (decision === 'STEP_UP') return { rapDecision: 'step_up', nextStep: 'reauthorize' };
  if (decision === 'ESCALATE') return { rapDecision: 'escalate', nextStep: 'human_approval' };
  return { rapDecision: 'deny', nextStep: 'block' };
}

function trustZone(trustScore) {
  if (trustScore >= 0.8) return 'active';
  if (trustScore >= 0.6) return 'degraded';
  if (trustScore >= 0.35) return 'warning';
  return 'critical';
}

function evaluateTrust(request) {
  const trustScore = Number(request.context?.trustScore ?? 0);
  const risk = computeRisk(request);
  const cost = computeCost(request);
  const compliance = computeCompliance(request, risk);

  const base = {
    outcome: 'DENY',
    mode: 'FAILED_CLOSED',
    reasonCodes: ['failed_closed'],
    constraintsApplied: [],
    approvalsRequired: [],
    trustScore,
    risk,
    cost,
    compliance
  };

  if (!request.action || !request.resource?.id) {
    return { ...base, reasonCodes: ['invalid_request_shape'] };
  }

  if (!request.authorityGrant) {
    return { ...base, outcome: 'ESCALATE', mode: 'REQUIRES_HUMAN_APPROVAL', reasonCodes: ['missing_authority_grant'], approvalsRequired: ['authority-admin'] };
  }

  const grant = grants.get(request.authorityGrant.grantId);
  if (!grant) {
    return { ...base, reasonCodes: ['unknown_authority_grant'] };
  }

  if (Date.parse(grant.expiresAt) <= Date.now()) {
    return { ...base, reasonCodes: ['expired_authority_grant'] };
  }

  const requestedScope = `${request.action}:${request.resource?.id ?? 'unknown'}`;
  const inScope = grant.scope.includes(requestedScope);

  if (trustScore < 0.4) {
    return { ...base, reasonCodes: ['trust_below_deny_threshold'] };
  }

  if (risk.riskLevel === 'CRITICAL' || (String(request.context?.agentType ?? '').toLowerCase() === 'mythos' && String(request.context?.environment ?? '').toLowerCase() === 'prod')) {
    return {
      ...base,
      outcome: 'ESCALATE',
      mode: 'REQUIRES_HUMAN_APPROVAL',
      reasonCodes: ['high_or_critical_risk'],
      approvalsRequired: ['security-approver']
    };
  }

  if (cost.budgetDecision === 'OVER_BUDGET') {
    return { ...base, reasonCodes: ['budget_policy_violation'] };
  }

  if (trustScore < 0.65) {
    return {
      ...base,
      outcome: 'STEP_UP',
      mode: 'REQUIRES_REATTESTATION',
      reasonCodes: ['trust_requires_step_up'],
      constraintsApplied: ['provide-fresh-attestation']
    };
  }

  if (!inScope) {
    return {
      ...base,
      outcome: 'PERMIT',
      mode: 'CONSTRAINED',
      reasonCodes: ['scope_mismatch_constrained_permit'],
      constraintsApplied: ['limit-to-grant-scope']
    };
  }

  if (trustScore < 0.85 || risk.riskLevel === 'HIGH' || cost.budgetDecision === 'REQUIRES_APPROVAL') {
    return {
      ...base,
      outcome: 'PERMIT',
      mode: 'CONSTRAINED',
      reasonCodes: ['constrained_by_trust_risk_or_budget'],
      constraintsApplied: ['read-only-or-limited-mutation']
    };
  }

  return {
    ...base,
    outcome: 'PERMIT',
    mode: 'FULL',
    reasonCodes: ['trusted_and_authorized']
  };
}

function buildReceipt(request, decisionResult) {
  const previousReceipt = receipts.length ? receipts[receipts.length - 1] : null;
  const issuedAt = new Date().toISOString();
  const receiptId = crypto.randomUUID();

  const receipt = {
    schemaVersion: '1.0.0',
    receiptId,
    issuedAt,
    execution: {
      executionId: request.requestId ?? crypto.randomUUID(),
      surface: String(request.context?.source ?? 'OTHER').toUpperCase(),
      subject: {
        id: request.principal?.id ?? request.subject ?? 'unknown-subject',
        type: String(request.principal?.type ?? 'SYSTEM').toUpperCase(),
        displayName: request.principal?.id ?? request.subject ?? 'unknown-subject'
      },
      delegatedPrincipal: {
        id: request.context?.delegatedPrincipal ?? '',
        type: request.context?.delegatedPrincipalType ?? '',
        displayName: request.context?.delegatedPrincipal ?? ''
      },
      authorityGrantRef: request.authorityGrant?.grantId ?? '',
      attestationRef: request.attestationRef ?? '',
      action: request.action ?? 'unknown-action',
      resource: request.resource?.id ?? 'unknown-resource',
      environment: String(request.context?.environment ?? 'OTHER').toUpperCase(),
      context: request.context ?? {}
    },
    decision: {
      outcome: decisionResult.outcome,
      mode: decisionResult.mode,
      reasonCodes: decisionResult.reasonCodes,
      constraintsApplied: decisionResult.constraintsApplied,
      approvalsRequired: decisionResult.approvalsRequired,
      approvalsObserved: [],
      latencyMs: 0,
      policySetVersion: 'policy-v1',
      evaluatorVersion: 'runtime-authority-gate-v1'
    },
    trust: {
      trustScore: decisionResult.trustScore,
      baselineScore: Number(request.context?.baselineTrust ?? decisionResult.trustScore),
      decayRate: Number(request.context?.decayRate ?? 0.03),
      lastRechargeAt: request.context?.lastRechargeAt ?? issuedAt,
      attestationWeightTotal: Number(request.context?.attestationWeightTotal ?? 0),
      attestationsConsidered: request.context?.attestationsConsidered ?? []
    },
    risk: {
      riskScore: decisionResult.risk.riskScore,
      riskLevel: decisionResult.risk.riskLevel,
      blastRadius: decisionResult.risk.blastRadius,
      riskFactors: decisionResult.risk.riskFactors,
      uncertaintyFlags: [],
      sensitiveResourcesTouched: [],
      stepUpReasons: decisionResult.outcome === 'STEP_UP' ? decisionResult.reasonCodes : [],
      policyConflicts: []
    },
    cost: decisionResult.cost,
    compliance: decisionResult.compliance,
    evidence: {
      evidenceRefs: request.context?.evidenceRefs ?? [],
      artifacts: [],
      approvalTrail: [],
      notes: []
    },
    integrity: {
      canonicalization: 'OTHER',
      hashAlgorithm: 'SHA-256',
      hash: '',
      signatureStatus: 'UNSIGNED',
      signature: '',
      signatureAlg: '',
      signatureRef: '',
      signingKeyRef: '',
      chainHash: previousReceipt?.integrity?.hash ?? ''
    }
  };

  const canonical = JSON.stringify({ ...receipt, integrity: { ...receipt.integrity, hash: '' } });
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  receipt.integrity.hash = hash;

  const signed = signHash(hash);
  receipt.integrity.signatureStatus = signed.signatureStatus;
  receipt.integrity.signature = signed.signature;
  receipt.integrity.signatureAlg = signed.signatureAlg;
  receipt.integrity.signatureRef = signed.signatureRef;
  receipt.integrity.signingKeyRef = signed.signingKeyRef;

  return receipt;
}

function buildAuthorizeResponse(decisionResult, receipt) {
  const rap = mapToRap(decisionResult.outcome, decisionResult.mode);
  const zone = trustZone(decisionResult.trustScore);
  const evaluationTier = decisionResult.trustScore >= 0.85 && decisionResult.risk.riskLevel === 'LOW' ? 'fast' : 'full';

  return {
    decision: decisionResult.outcome,
    mode: decisionResult.mode,
    reasonCodes: decisionResult.reasonCodes,
    constraintsApplied: decisionResult.constraintsApplied,
    approvalsRequired: decisionResult.approvalsRequired,
    trust: { trustScore: decisionResult.trustScore, trustZone: zone },
    risk: {
      riskScore: decisionResult.risk.riskScore,
      riskLevel: decisionResult.risk.riskLevel,
      blastRadius: decisionResult.risk.blastRadius
    },
    cost: {
      estimatedCost: decisionResult.cost.estimatedCost,
      budgetDecision: decisionResult.cost.budgetDecision,
      costCenter: decisionResult.cost.costCenter
    },
    compliance: {
      retentionClass: decisionResult.compliance.retentionClass,
      frameworkApplicability: decisionResult.compliance.frameworkApplicability
    },
    rapDecision: rap.rapDecision,
    nextStep: rap.nextStep,
    evaluationTier,
    receiptId: receipt.receiptId,
    receipt
  };
}

const server = http.createServer(async (req, res) => {
  const url = normalizeUrl(req);

  if (req.method === 'GET' && url.pathname === '/healthz') {
    return json(res, 200, {
      status: 'ok',
      service: 'runtime-authority-gate',
      evaluatorVersion: 'runtime-authority-gate-v1',
      storage: storeMetadata(),
      signing: signingMetadata()
    });
  }

  if (req.method === 'POST' && url.pathname === '/utils/binding-hash') {
    try {
      const payload = await readBody(req);
      const bindingHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      return json(res, 200, { bindingHash, hashAlgorithm: 'SHA-256' });
    } catch {
      return json(res, 400, { error: 'invalid_request' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/re/authorize') {
    try {
      const request = await readBody(req);
      const started = Date.now();
      const decisionResult = evaluateTrust(request);
      const receipt = buildReceipt(request, decisionResult);
      receipt.decision.latencyMs = Date.now() - started;
      receipts.push(receipt);
      saveReceipts(receipts);

      return json(res, 200, buildAuthorizeResponse(decisionResult, receipt));
    } catch {
      return json(res, 400, { error: 'invalid_request' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/re/reauthorize') {
    try {
      const body = await readBody(req);
      const priorReceipt = receipts.find((r) => r.receiptId === body.priorReceiptId);
      if (!priorReceipt) return json(res, 404, { error: 'receipt_not_found' });

      const approved = Boolean(body.approval?.approvedBy);
      const decisionResult = approved
        ? {
            outcome: 'PERMIT',
            mode: 'CONSTRAINED',
            reasonCodes: ['human_approval_observed'],
            constraintsApplied: ['approval-bound-session'],
            approvalsRequired: [],
            trustScore: priorReceipt.trust.trustScore,
            risk: priorReceipt.risk,
            cost: priorReceipt.cost,
            compliance: priorReceipt.compliance
          }
        : {
            outcome: 'ESCALATE',
            mode: 'REQUIRES_HUMAN_APPROVAL',
            reasonCodes: ['approval_missing_or_invalid'],
            constraintsApplied: [],
            approvalsRequired: ['security-approver'],
            trustScore: priorReceipt.trust.trustScore,
            risk: priorReceipt.risk,
            cost: priorReceipt.cost,
            compliance: priorReceipt.compliance
          };

      const syntheticRequest = {
        requestId: body.requestId ?? crypto.randomUUID(),
        subject: priorReceipt.execution.subject.id,
        action: priorReceipt.execution.action,
        resource: { id: priorReceipt.execution.resource },
        context: {
          ...priorReceipt.execution.context,
          source: 'REAUTHORIZE',
          evidenceRefs: [...(priorReceipt.evidence.evidenceRefs || []), body.approval?.evidenceRef].filter(Boolean)
        },
        authorityGrant: { grantId: priorReceipt.execution.authorityGrantRef, expiresAt: new Date(Date.now() + 300000).toISOString() }
      };

      const receipt = buildReceipt(syntheticRequest, decisionResult);
      receipt.integrity.chainHash = priorReceipt.integrity.hash;
      receipts.push(receipt);
      saveReceipts(receipts);
      return json(res, 200, buildAuthorizeResponse(decisionResult, receipt));
    } catch {
      return json(res, 400, { error: 'invalid_request' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/receipts') {
    return json(res, 200, { count: receipts.length, receipts: receipts.map((r) => ({ receiptId: r.receiptId, issuedAt: r.issuedAt, outcome: r.decision.outcome })) });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/receipts/')) {
    const id = url.pathname.split('/')[2];
    const receipt = receipts.find((r) => r.receiptId === id);
    if (!receipt) return json(res, 404, { error: 'receipt_not_found' });
    return json(res, 200, receipt);
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`runtime-authority-gate listening on :${PORT}`);
});
