#!/usr/bin/env node
// PCTR <-> Microsoft AGT (Agent Governance Toolkit), the closed loop from
// docs/integration-guide.md Part 6:
//
//   1. AGT enforces pre-execution policy
//   2. PCTR observes the consequence, the route and the signed receipt
//   3. Trust is recomputed from that behavioural evidence
//   4. AGT consumes it and adjusts the next decision
//
// AGT stays authoritative for allow/deny. PCTR supplies the evidence it decides on.
// Run: node examples/pctr-agt-bridge-demo.mjs
import {
  buildGraph, createTimeline, ingest, replay, protect, previewConsequence, resolveRoute,
  agtClaims, toAgtTrustScore, toTrustEvidence, toMeshAttestation, parseSpiffeId, verifyReceipt
} from '../packages/pctr/src/index.mjs';

const line = (s = '') => console.log(s);

// SPIFFE SVIDs are the agent ids, per integration-guide.md 6.3.
const FINANCE = 'spiffe://blocksifr.com/ns/prod/sa/finance-agent';
const PLANNER = 'spiffe://blocksifr.com/ns/prod/sa/planner';

const graph = buildGraph({
  principal: PLANNER,
  agents: [{
    id: FINANCE, framework: 'microsoft-agt', trust: 0.97, evidenceAgeSeconds: 20,
    authority: ['payments.*'], jurisdiction: 'eu', latencyMs: 90, tools: ['payments']
  }],
  tools: [{ id: 'payments', protocol: 'mcp', actions: ['payments.transfer'] }],
  actions: [{ id: 'payments.transfer', amount: 1800, connectedWorkflows: 2 }],
  policy: { requireApprovalAtOrAbove: 'CRITICAL', approvalThresholds: { amount: 5000 } }
});

const timeline = createTimeline({ objective: 'Settle supplier invoice INV-4471' });

// 1. AGT's own runtime events, in AGT's own shapes.
ingest('agt', [
  { type: 'agent.registered', agentId: FINANCE, trustScore: { overall: 0.97, dimensions: {}, tier: 'Verified' } },
  { type: 'telemetry.heartbeat', agentId: FINANCE },
  { type: 'action.invocation', agentId: FINANCE, action: 'payments.transfer', parameters: { amount: 18000 } }
], timeline);

line('NORMALIZED FROM AGT');
for (const e of replay(timeline)) line(`  ${e.line}`);
line();
line(`Agent id is a SPIFFE SVID in trust domain: ${parseSpiffeId(FINANCE).trustDomain}`);

// 2. What PCTR hands AGT's policy engine, under input.ttp.
const preview = previewConsequence(graph, 'payments.transfer', { amount: 18000 });
const route = resolveRoute(graph, 'payments.transfer', { severity: preview.severity });
const claims = agtClaims({ route, preview, issuerCount: 2 });

line();
line('OPA/REGO INPUT  (input.ttp)');
line(JSON.stringify(claims, null, 2).split('\n').map((l) => `  ${l}`).join('\n'));

line();
line('The policy AGT evaluates stays authoritative:');
line('  package agt.authz');
line('  allow {');
line('    input.ttp.ttp_domain == "payments"');
line(`    input.ttp.ttp_score >= 0.92        # this run: ${claims.ttp.ttp_score}`);
line(`    input.ttp.issuer_count >= 2        # this run: ${claims.ttp.issuer_count}`);
line('  }');
const trustScore = toAgtTrustScore(claims.ttp.ttp_score);
line(`  -> AGT TrustScore: overall ${trustScore.overall}, tier ${trustScore.tier}`);
line(`     (AGT scores 0-1 and bands it: untrusted 0.0 / provisional 0.3 / trusted 0.6 / verified 0.85)`);
line(`  -> required ExecutionRing for this consequence: Ring${claims.ttp.required_ring}`);

// 3. PCTR protects the execution and signs a receipt for what actually happened.
const request = { action: 'payments.transfer', target: 'acct:9931', params: { amount: 18000 }, agent: FINANCE };
const denied = await protect(graph, request, { timeline });
line();
line(`Without approval: ${denied.receipt.verifier.decision} — ${denied.receipt.verifier.failures[0].message}`);

const allowed = await protect(graph, request, {
  timeline, approval: { by: 'ops-oncall' }, execute: () => ({ transferId: 'tr_88213' })
});
line(`With approval:    ${allowed.receipt.verifier.decision}, receipt verifies: ${verifyReceipt(allowed.receipt).valid}`);

// 4. The evidence that goes back so AGT decides better next time.
line();
line('BEHAVIOURAL EVIDENCE  (step 2 of the loop, submitted back to AGT)');
line(JSON.stringify(toTrustEvidence(allowed.receipt), null, 2).split('\n').map((l) => `  ${l}`).join('\n'));

line();
line('AGENTMESH ATTESTATION  (peer trust, traceable to the receipt)');
const attestation = toMeshAttestation(allowed.receipt, { peer: 'spiffe://partner.example/ns/prod/sa/mesh' });
line(`  ${attestation.type}: ${attestation.outcome} on ${attestation.action}`);
line(`  trustScore    ${attestation.trustScore.overall} (${attestation.trustScore.tier})`);
line(`  evidence      ${attestation.evidence.receiptId}`);
line(`  signed by     ${attestation.evidence.signedBy}`);

line();
line('A denial is the stronger signal: weight ' +
  `${toTrustEvidence(denied.receipt).weight} (denied) vs ${toTrustEvidence(allowed.receipt).weight} (allowed).`);
