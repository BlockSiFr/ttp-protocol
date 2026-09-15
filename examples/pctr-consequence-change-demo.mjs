#!/usr/bin/env node
// PCTR end-to-end: a transfer changes mid-run, the consequence changes with it,
// the route it was riding on becomes inadmissible, and authority is re-established
// on the new terms. Run: node examples/pctr-consequence-change-demo.mjs
import {
  buildGraph, previewConsequence, consequenceChanged, resolveRoute, reroute,
  protect, createTimeline, replay, why, verifyReceipt
} from '../packages/pctr/src/index.mjs';

const graph = buildGraph({
  principal: 'user:ops',
  agents: [
    { id: 'planner', framework: 'openai-agents', trust: 0.98, evidenceAgeSeconds: 15, authority: ['*'], jurisdiction: 'eu', latencyMs: 60, tools: [], delegatesTo: ['finance-agent-a', 'finance-agent-d'] },
    { id: 'finance-agent-a', framework: 'langgraph', trust: 0.96, evidenceAgeSeconds: 240, authority: ['payments.*'], jurisdiction: 'eu', latencyMs: 40, tools: ['payments'] },
    { id: 'finance-agent-d', framework: 'claude-agents', trust: 0.97, evidenceAgeSeconds: 20, authority: ['payments.*'], jurisdiction: 'eu', latencyMs: 130, tools: ['payments'] }
  ],
  tools: [{ id: 'payments', protocol: 'mcp', actions: ['payments.transfer'] }],
  actions: [{ id: 'payments.transfer', amount: 1800, connectedWorkflows: 2 }],
  policy: { requireApprovalAtOrAbove: 'CRITICAL', approvalThresholds: { amount: 5000 }, decayPerHop: 0.05 }
});

const timeline = createTimeline({ objective: 'Pay invoice INV-4471' });
const line = (s = '') => console.log(s);

// 1. The objective arrives and the first amount is proposed.
const started = timeline.record('AGENT_STARTED', { objective: 'Pay invoice INV-4471' }, { subject: 'planner' });
const first = timeline.record('ACTION_PROPOSED', { action: 'payments.transfer', amount: 1800 }, { subject: 'planner', because: [started.id] });

const before = previewConsequence(graph, 'payments.transfer', { amount: 1800 });
timeline.record('CONSEQUENCE_DETECTED', { consequence: before.consequence, severity: before.severity }, { because: [first.id] });
const routeBefore = resolveRoute(graph, 'payments.transfer', { severity: before.severity });
const selectedBefore = timeline.record('ROUTE_SELECTED', { routeId: routeBefore.selected.routeId }, { because: [first.id] });

line(`Proposed transfer: $1,800 -> ${before.severity}`);
line(`Route: ${routeBefore.selected.routeId}`);

// 2. The amount changes. The consequence changes with it.
const changed = timeline.record('ACTION_PROPOSED', { action: 'payments.transfer', amount: 18000 }, { subject: 'planner', because: [first.id] });
const after = previewConsequence(graph, 'payments.transfer', { amount: 18000 });
const detected = timeline.record('CONSEQUENCE_DETECTED',
  { consequence: after.consequence, severity: after.severity, reason: `Transfer increased from $1,800 to $18,000, so the consequence is now ${after.severity}.` },
  { because: [changed.id] });

line();
line(`Amount changed: $1,800 -> $18,000  (consequence changed: ${consequenceChanged(before, after)})`);

// 3. The route it was riding on is no longer admissible for the new consequence.
timeline.record('ROUTE_INVALIDATED',
  { routeId: routeBefore.selected.routeId, reason: 'The consequence changed, so the route selected for the smaller transfer is no longer admissible.', policy: 'local-v1' },
  { because: [detected.id, selectedBefore.id] });

// Rerouting may never admit a route on weaker grounds than the one it replaces.
const attemptedDowngrade = reroute(graph, 'payments.transfer', { ...routeBefore, severity: 'CRITICAL', trustRequired: 0.9 }, { severity: 'MEDIUM' });
line(`Attempted cheaper route at lower severity: ${attemptedDowngrade.expansionBlocked ? 'BLOCKED (authority may not silently expand)' : 'allowed'}`);

// 4. Run the protected loop at the new consequence — first without approval.
const denied = await protect(graph, { action: 'payments.transfer', target: 'acct:9931', params: { amount: 18000 }, agent: 'planner' }, { timeline });
line();
line(`Without approval: ${denied.receipt.verifier.decision} — ${denied.receipt.verifier.failures[0].message}`);

// 5. Approval is recorded, and authority is bound to this exact execution.
const allowed = await protect(graph,
  { action: 'payments.transfer', target: 'acct:9931', params: { amount: 18000 }, agent: 'planner' },
  { timeline, approval: { by: 'ops-oncall', at: new Date().toISOString() }, execute: () => ({ transferId: 'tr_88213' }) });

line(`With approval:    ${allowed.receipt.verifier.decision} — executed ${allowed.result.status}`);
line(`Receipt ${allowed.receipt.receiptId} verifies: ${verifyReceipt(allowed.receipt).valid}`);

line();
line('TIMELINE');
for (const e of replay(timeline)) line(`  ${e.at.slice(11, 19)}  ${e.line}`);

const answer = why(timeline, 'ROUTE_INVALIDATED');
line();
line(answer.question);
line(`  ${answer.answer}`);
for (const b of answer.because) line(`  - ${b}`);
