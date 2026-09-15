import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { verify_attestation, prove_trust_threshold } from '../../../src/index.mjs';
import { aggregateTrust, scoreLabel, DEFAULT_PARAMS, INSUFFICIENT_TRUST_DATA } from './aggregate.mjs';
import { TRUST_REQUIRED, MAX_EVIDENCE_AGE_SECONDS } from './trust.mjs';

// MEASURED TRUST.
//
// Everything downstream of a trust score is rigorous about it — thresholds, decay, route
// admissibility, execution authority. None of that means much while the score itself is
// a number somebody typed into pctr.json. This turns it into something observed.
//
// The rule that governs the whole file: absent evidence is not trust. An agent with no
// attestations does not inherit its declared score; it comes back UNPROVEN, and a
// protected consequence must not route through an agent whose trust was never measured.

// A behavioural receipt scored per protocol/scoring-semantics.md 3.2 (tool_execution).
// PCTR's own execution receipts are exactly what that section describes an issuer
// observing, so they are the one attestation source that needs no configuration.
export function scoreExecutionReceipt(receipt) {
  const decision = receipt.verifier?.decision;
  const codes = (receipt.verifier?.failures ?? []).map((f) => f.code);

  if (decision === 'EXECUTION_ALLOWED') {
    // Completed successfully, parameters bound and verified.
    return receipt.executed?.status === 'FAILED' ? 0.70 : 0.95;
  }
  // "Attempted to call a disallowed tool" — the agent reached for authority it lacks.
  if (codes.includes('INSUFFICIENT_AUTHORITY') || codes.includes('UNTRUSTED_SIGNER')) return 0.15;
  // "Tool call failed — policy violation detected"
  if (codes.includes('REPLAYED_AUTHORITY') || codes.includes('BINDING_HASH_MISMATCH') ||
      codes.includes('SIGNATURE_INVALID') || codes.includes('PARAMETER_MISMATCH') ||
      codes.includes('TARGET_MISMATCH')) return 0.20;
  // "Parameters outside allowed bounds"
  if (codes.includes('CONSTRAINT_EXCEEDED')) return 0.35;
  // Waiting on a human, or the environment was unavailable: not the agent misbehaving.
  if (codes.includes('APPROVAL_REQUIRED') || codes.includes('APPROVAL_MISSING')) return 0.75;
  if (codes.includes('BOUNDARY_UNREACHABLE') || codes.includes('AUTHORITY_EXPIRED')) return 0.65;
  if (codes.includes('STALE_EVIDENCE')) return 0.60;
  return 0.50;   // refused for a reason we do not recognise: marginal, not condemned
}

// PCTR's own receipts, as behavioural receipts for the aggregator.
export function behaviouralReceipts(agentId, receipts = []) {
  return receipts
    .filter((r) => (r.routeSelected?.agents ?? []).includes(agentId) || r.requestedBy === agentId)
    .map((r) => ({
      receipt_id: r.receiptId,
      issuer_id: 'pctr.effect-boundary',
      score: scoreExecutionReceipt(r),
      timestamp: new Date(r.executed?.executedAt ?? r.issuedAt).getTime()
    }));
}

const ATTESTATION_TIMEOUT_MS = 10_000;

// An external attestor: a module exporting a function, or a command printing JSON.
// It returns TTP attestations, behavioural receipts, or both.
export async function runAttestor(spec, context, { cwd = process.cwd(), timeoutMs = ATTESTATION_TIMEOUT_MS } = {}) {
  const attestor = typeof spec === 'string' ? { module: spec } : spec;
  try {
    const raw = attestor.command
      ? await runCommand(attestor.command, attestor.args ?? [], context, { cwd, timeoutMs })
      : await runModule(attestor.module, context, { cwd });
    return { ok: true, source: attestor.command ?? attestor.module, ...normalizeAttestorOutput(raw) };
  } catch (error) {
    // A broken attestor produces no evidence. It must never produce favourable evidence.
    return { ok: false, source: attestor.command ?? attestor.module, attestations: [], receipts: [], error: error.message ?? String(error) };
  }
}

function normalizeAttestorOutput(raw) {
  if (Array.isArray(raw)) return { attestations: raw, receipts: [] };
  return { attestations: raw?.attestations ?? [], receipts: raw?.receipts ?? [] };
}

async function runModule(modulePath, context, { cwd }) {
  const mod = await import(pathToFileURL(path.resolve(cwd, modulePath)).href);
  const fn = mod.default ?? mod.attest;
  if (typeof fn !== 'function') throw new Error(`${modulePath} does not export an attestor function`);
  return await fn(context);
}

function runCommand(command, args, context, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd, timeout: timeoutMs, maxBuffer: 1024 * 1024,
      env: { ...process.env, PCTR_AGENT: context.agentId ?? '' }
    }, (error, stdout) => {
      if (error) return reject(new Error(`attestor failed: ${error.message.split('\n')[0]}`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('attestor did not return JSON')); }
    });
  });
}

/**
 * Measure one agent's trust from evidence.
 *
 * Returns { trust, proven, label, ... }. `proven` is false when there was no admissible
 * evidence — callers must treat that as unproven, never as the declared value.
 */
export async function attestAgent(agent, {
  receipts = [], attestors = [], severity = 'MEDIUM', at = new Date().toISOString(),
  cwd = process.cwd(), params = {}
} = {}) {
  const now = new Date(at).getTime();
  const maxAge = MAX_EVIDENCE_AGE_SECONDS[severity] ?? DEFAULT_PARAMS.receipt_window_s;
  const collected = [];
  const attestationResults = [];
  const errors = [];

  // Source 1: PCTR's own execution receipts.
  collected.push(...behaviouralReceipts(agent.id, receipts));

  // Source 2: configured attestors.
  for (const spec of attestors) {
    const result = await runAttestor(spec, { agentId: agent.id, severity }, { cwd });
    if (!result.ok) { errors.push({ source: result.source, error: result.error }); continue; }

    for (const attestation of result.attestations) {
      // Verified through TTP's own primitive, not a second opinion invented here.
      const verified = verify_attestation({
        attestation, subject: agent.id, validAt: at,
        maxAge: attestation.maxAge ?? maxAge,
        requiredIssuer: attestation.requiredIssuer, requiredType: attestation.requiredType
      });
      attestationResults.push({ ...verified, source: result.source });
      if (!verified.valid) continue;

      // A verified attestation contributes as a receipt from its issuer.
      collected.push({
        receipt_id: attestation.ref ?? `att-${attestationResults.length}`,
        issuer_id: attestation.issuer,
        score: typeof attestation.score === 'number' ? attestation.score : 0.5 + (verified.trustScoreDelta ?? 0),
        timestamp: new Date(attestation.issuedAt).getTime()
      });
    }
    for (const r of result.receipts) {
      collected.push({ receipt_id: r.receipt_id ?? r.receiptId, issuer_id: r.issuer_id ?? result.source, score: r.score, timestamp: r.timestamp ?? now });
    }
  }

  const aggregated = aggregateTrust(collected, now, { receipt_window_s: maxAge, ...params });
  const proven = !aggregated.error;

  return {
    agentId: agent.id,
    proven,
    trust: proven ? Number(aggregated.score.toFixed(4)) : null,
    label: scoreLabel(proven ? aggregated.score : null),
    declaredTrust: agent.trust ?? null,
    // The gap between what was claimed and what the evidence supports.
    drift: proven && agent.trust != null ? Number((aggregated.score - agent.trust).toFixed(4)) : null,
    contributingReceipts: aggregated.contributing_receipts ?? 0,
    contributingIssuers: aggregated.contributing_issuers ?? 0,
    oldestEvidenceAgeSeconds: aggregated.oldest_receipt_age_s ?? null,
    issuers: aggregated.issuers ?? [],
    attestations: attestationResults,
    errors,
    reason: proven ? null : INSUFFICIENT_TRUST_DATA,
    measuredAt: at
  };
}

// A TTP TrustThresholdProof over measured trust: the artefact that says this agent
// cleared the bar this consequence sets, with the evidence it rests on.
export function proveThreshold(measurement, severity, { at = new Date().toISOString(), proofMode = 'plain' } = {}) {
  const required = TRUST_REQUIRED[severity] ?? 0;
  return prove_trust_threshold({
    subject: measurement.agentId,
    trustScore: measurement.proven ? measurement.trust : 0,
    requiredThreshold: required,
    dimension: `execution-authority:${severity}`,
    evaluatedAt: at,
    proofMode,
    evidenceRefs: [
      ...measurement.attestations.filter((a) => a.valid).map((a) => a.attestationRef).filter(Boolean),
      ...measurement.issuers.map((i) => `issuer:${i.issuer_id}`)
    ]
  });
}

// Measure every agent in a graph, and say plainly which ones are running on a number
// somebody typed rather than on evidence.
export async function attestGraph(graph, { receipts = [], attestors = {}, severity = 'MEDIUM', at, cwd } = {}) {
  const agents = [...graph.nodes.values()].filter((n) => n.type === 'agent');
  const measurements = [];
  for (const agent of agents) {
    measurements.push(await attestAgent(agent, {
      receipts, attestors: attestors[agent.id] ?? attestors['*'] ?? [], severity, at, cwd
    }));
  }
  return {
    measurements,
    proven: measurements.filter((m) => m.proven).length,
    unproven: measurements.filter((m) => !m.proven).map((m) => m.agentId),
    overstated: measurements.filter((m) => m.drift != null && m.drift < -0.1)
      .map((m) => ({ agentId: m.agentId, declared: m.declaredTrust, measured: m.trust, drift: m.drift }))
  };
}
