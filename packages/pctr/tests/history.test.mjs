import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeHistory, failureRate, rankByHistory, whatIf } from '../src/history.mjs';
import { buildGraph } from '../src/graph.mjs';
import { resolveRoute } from '../src/router.mjs';
import { renderGraphSvg } from '../src/graph_svg.mjs';

const manifest = () => ({
  principal: 'user:test',
  agents: [
    { id: 'fast', trust: 0.97, evidenceAgeSeconds: 5, authority: ['payments.*'], latencyMs: 10, tools: ['payments'] },
    { id: 'slow', trust: 0.97, evidenceAgeSeconds: 5, authority: ['payments.*'], latencyMs: 400, tools: ['payments'] }
  ],
  tools: [{ id: 'payments', protocol: 'mcp', actions: ['payments.transfer'] }],
  actions: [{ id: 'payments.transfer', amount: 100 }],
  policy: { requireApprovalAtOrAbove: 'CRITICAL', batchLimit: 25 }
});

const receipt = (over = {}) => ({
  receiptId: `r-${Math.random().toString(36).slice(2, 8)}`,
  requested: { action: 'payments.transfer', target: 't', params: { amount: 100 } },
  routeSelected: { routeId: 'user:test -> fast -> payments -> payments.transfer', agents: ['fast'] },
  verifier: { decision: 'EXECUTION_ALLOWED', failures: [] },
  consequence: { class: 'MONEY_MOVED', severity: 'HIGH' },
  issuedAt: '2026-09-15T00:00:00Z', ...over
});

test('history counts attempts and failures per route, agent and action', () => {
  const history = summarizeHistory([
    receipt(),
    receipt({ verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'APPROVAL_REQUIRED' }] } })
  ]);
  const route = history.byRoute['user:test -> fast -> payments -> payments.transfer'];
  assert.equal(route.attempts, 2);
  assert.equal(route.failures, 1);
  assert.equal(history.byAgent.fast.attempts, 2);
  assert.equal(history.total, 2);
});

test('a single failure is not treated as a pattern', () => {
  const history = summarizeHistory([receipt({ verifier: { decision: 'EXECUTION_DENIED', failures: [] } })]);
  assert.equal(failureRate(history, 'user:test -> fast -> payments -> payments.transfer'), 0);
});

test('history prefers the route that works, among routes already admissible', () => {
  const graph = buildGraph(manifest());
  const fastRoute = 'user:test -> fast -> payments -> payments.transfer';

  // With no history the faster route wins on latency.
  assert.equal(resolveRoute(graph, 'payments.transfer').selected.agents[0], 'fast');

  // Given a record of the fast route failing, the slower one is preferred.
  const history = summarizeHistory(Array.from({ length: 4 }, () =>
    receipt({ verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'BOUNDARY_UNREACHABLE' }] } })));
  assert.ok(failureRate(history, fastRoute) > 0);
  assert.equal(resolveRoute(graph, 'payments.transfer', { history }).selected.agents[0], 'slow');
});

test('history can never make an inadmissible route admissible', () => {
  const m = manifest();
  m.agents.forEach((a) => { a.authority = ['reports.read']; });   // neither may transfer
  const graph = buildGraph(m);
  const history = summarizeHistory(Array.from({ length: 20 }, () => receipt()));   // a perfect record
  const result = resolveRoute(graph, 'payments.transfer', { history });
  assert.equal(result.selected, null, 'a flawless history does not buy authority');
  assert.equal(result.admissible.length, 0);
});

test('what-if replays real history against a proposed policy', () => {
  // A low approval threshold refused these $600 transfers. Note $18,000 would not work
  // as an example: past $5,000 the consequence itself is CRITICAL, and CRITICAL requires
  // approval whatever the threshold says — the amount changes the severity, not just the
  // rule that reads it.
  const m = manifest();
  m.policy.approvalThresholds = { amount: 50 };
  const graph = buildGraph(m);
  const receipts = Array.from({ length: 3 }, () => receipt({
    requested: { action: 'payments.transfer', target: 't', params: { amount: 600 } },
    verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'APPROVAL_REQUIRED' }] }
  }));

  const loosened = whatIf(graph, receipts, { policy: { approvalThresholds: { amount: 25000 } } });
  assert.equal(loosened.considered, 3);
  assert.ok(loosened.loosens >= 1, 'executions that were refused would now proceed');
  assert.match(loosened.verdict, /would now proceed/);
  assert.equal(loosened.changes[0].direction, 'LOOSENS');
});

test('raising an approval threshold cannot unlock a CRITICAL consequence', () => {
  // The severity comes from what the action can cause, so no threshold edit reaches it.
  const graph = buildGraph(manifest());
  const receipts = [receipt({
    requested: { action: 'payments.transfer', target: 't', params: { amount: 18000 } },
    verifier: { decision: 'EXECUTION_DENIED', failures: [{ code: 'APPROVAL_REQUIRED' }] }
  })];
  const result = whatIf(graph, receipts, { policy: { approvalThresholds: { amount: 1000000 } } });
  assert.equal(result.loosens, 0, 'a $18,000 transfer stays CRITICAL and still needs a human');
});

test('what-if reports when a policy change would have stopped what happened', () => {
  const graph = buildGraph(manifest());
  const receipts = Array.from({ length: 2 }, () => receipt());   // allowed, $100
  const tightened = whatIf(graph, receipts, { policy: { escalateAtOrAbove: 'LOW', escalateTo: 'security' } });
  assert.ok(tightened.tightens >= 1);
  assert.match(tightened.verdict, /would now be stopped/);
});

test('what-if executes nothing and changes nothing', () => {
  const graph = buildGraph(manifest());
  const before = JSON.stringify(graph.manifest);
  whatIf(graph, [receipt()], { policy: { batchLimit: 1 } });
  assert.equal(JSON.stringify(graph.manifest), before);
});

test('the graph renders as SVG that answers the questions it must', () => {
  const graph = buildGraph(manifest());
  const svg = renderGraphSvg(graph);
  assert.match(svg, /^<svg xmlns/);
  assert.match(svg, /<\/svg>\n$/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="[^"]+"/, 'a picture must be readable by something that cannot see it');
  assert.ok(svg.includes('fast') && svg.includes('payments.transfer'), 'agents and actions are drawn');
  assert.ok(!/[→⏱]/.test(svg), 'no glyphs that render as tofu in the brand fonts');
});

test('naming an action draws its selected route and says so to a screen reader', () => {
  const graph = buildGraph(manifest());
  const svg = renderGraphSvg(graph, { action: 'payments.transfer' });
  assert.match(svg, /Execution authority for payments.transfer/);
  assert.match(svg, /aria-label="[^"]*selected route runs[^"]*"/);
  assert.ok(svg.includes('#00E676'), 'the selected route is drawn in the route colour');
});

test('an unreachable action says so rather than drawing a route that does not exist', () => {
  const m = manifest();
  m.agents.forEach((a) => { a.authority = []; });
  const svg = renderGraphSvg(buildGraph(m), { action: 'payments.transfer' });
  assert.match(svg, /aria-label="[^"]*No admissible route[^"]*"/);
});
