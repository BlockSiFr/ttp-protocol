#!/usr/bin/env node
// Four frameworks, one security meaning, one effect boundary.
// Each agent below emits its own native event shape. PCTR normalizes them into the
// canonical events, classifies the consequence, routes to a trustworthy agent, and has
// the authority verified by a boundary running in its own process.
// Run: node examples/pctr-universal-fabric-demo.mjs
import {
  buildGraph, createTimeline, ingest, replay, protect, why,
  startBoundaryServer, remoteBoundary, createBoundary, generateKeyPair, exportPublic, verifyReceipt
} from '../packages/pctr/src/index.mjs';

const line = (s = '') => console.log(s);

const graph = buildGraph({
  principal: 'user:ops',
  agents: [
    { id: 'planner', framework: 'openai-agents', trust: 0.98, evidenceAgeSeconds: 15, authority: ['*'], latencyMs: 60, tools: [], delegatesTo: ['research', 'finance'] },
    { id: 'research', framework: 'langgraph', trust: 0.9, evidenceAgeSeconds: 40, authority: ['reports.*'], latencyMs: 30, tools: ['reports'] },
    { id: 'finance', framework: 'crewai', trust: 0.97, evidenceAgeSeconds: 25, authority: ['payments.*'], latencyMs: 110, tools: ['payments'] }
  ],
  tools: [
    { id: 'reports', protocol: 'mcp', actions: ['reports.read'] },
    { id: 'payments', protocol: 'mcp', actions: ['payments.transfer'] }
  ],
  actions: [{ id: 'payments.transfer', amount: 1800, connectedWorkflows: 2 }],
  policy: { requireApprovalAtOrAbove: 'CRITICAL', approvalThresholds: { amount: 5000 } }
});

const timeline = createTimeline({ objective: 'Settle supplier invoice INV-4471' });

// Each framework hands PCTR the events it already emits. Nothing is rewritten to suit us.
ingest('openai-agents', [
  { type: 'agent_start', agent: 'planner', input: 'Settle supplier invoice INV-4471' },
  { type: 'token_usage', tokens: 1420 },
  { type: 'handoff', from_agent: 'planner', to_agent: 'research' }
], timeline);

ingest('langgraph', [
  { event: 'on_tool_start', name: 'reports.read', data: { input: { supplier: 'acme' } } },
  { event: 'on_llm_new_token', data: { chunk: 'The' } },
  { event: 'on_tool_end', name: 'reports.read' }
], timeline);

ingest('mcp', [
  { method: 'tools/list', server: 'payments', result: { tools: [{ name: 'payments.transfer' }, { name: 'payments.status' }] } }
], timeline);

ingest('crewai', [
  { type: 'agent_delegated', from_agent: 'planner', to_agent: 'finance' },
  { type: 'tool_usage_started', tool: 'payments.transfer', tool_args: { amount: 18000 }, agent: 'finance' }
], timeline);

line('NORMALIZED FROM FOUR FRAMEWORKS');
for (const e of replay(timeline)) line(`  ${e.line}`);

// The boundary holds the key list and the replay state, in its own process.
const key = generateKeyPair();
const boundary = createBoundary({ trustedKeyIds: [key.keyId], publicKey: exportPublic(key.publicKey) });
const { url, close } = await startBoundaryServer({ port: 0, boundary });

line();
line(`Effect boundary running at ${url}, trusting only ${key.keyId}`);

const request = { action: 'payments.transfer', target: 'acct:9931', params: { amount: 18000 }, agent: 'finance' };
const options = { timeline, boundary: remoteBoundary(url), keyPair: key };

const denied = await protect(graph, request, options);
line(`Without approval: ${denied.receipt.verifier.decision} — ${denied.receipt.verifier.failures[0].message}`);

const allowed = await protect(graph, request, {
  ...options, approval: { by: 'ops-oncall' }, execute: () => ({ transferId: 'tr_88213' })
});
line(`With approval:    ${allowed.receipt.verifier.decision} at ${allowed.receipt.verifier.boundary}`);
line(`Receipt verifies against the boundary's public key: ${verifyReceipt(allowed.receipt, { publicKey: exportPublic(key.publicKey) }).valid}`);

// Replaying the same authority is refused: it has already been spent.
const replayed = await remoteBoundary(url).verify(allowed.authority, {
  action: 'payments.transfer', target: 'acct:9931', params: { amount: 18000 }, principal: 'user:ops'
});
line(`Replaying that authority: ${replayed.decision} (${replayed.failures.map((f) => f.code).join(', ')})`);

const answer = why(timeline, 'EXECUTION_DENIED');
line();
line(answer.question);
line(`  ${answer.answer}`);
for (const b of answer.because.slice(-4)) line(`  - ${b}`);

await close();
