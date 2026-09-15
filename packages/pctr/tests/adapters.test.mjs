import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, ingest, supportedFrameworks } from '../src/adapters.mjs';
import { createTimeline, replay } from '../src/timeline.mjs';

test('every framework maps its own tool call onto the same security meaning', () => {
  const cases = [
    ['openai-agents', { type: 'tool_call', name: 'payments.transfer', arguments: { amount: 18000 }, agent: 'finance' }],
    ['claude-agents', { type: 'tool_use', name: 'payments.transfer', input: { amount: 18000 }, agent: 'finance' }],
    ['langgraph', { event: 'on_tool_start', name: 'payments.transfer', data: { input: { amount: 18000 } } }],
    ['crewai', { type: 'tool_usage_started', tool: 'payments.transfer', tool_args: { amount: 18000 }, agent: 'finance' }],
    ['autogen', { type: 'function_call', name: 'payments.transfer', arguments: '{"amount":18000}', sender: 'finance' }],
    ['semantic-kernel', { type: 'function_invoking', function: 'payments.transfer', arguments: { amount: 18000 } }],
    ['mcp', { method: 'tools/call', params: { name: 'payments.transfer', arguments: { amount: 18000 } } }],
    ['generic', { action: 'payments.transfer', params: { amount: 18000 } }]
  ];
  for (const [framework, event] of cases) {
    const normalized = normalize(framework, event);
    assert.equal(normalized.event, 'ACTION_PROPOSED', framework);
    assert.equal(normalized.detail.action, 'payments.transfer', framework);
    assert.equal(normalized.detail.consequence, 'MONEY_MOVED', framework);
    assert.equal(normalized.detail.severity, 'CRITICAL', framework); // $18,000 is over the limit
  }
});

test('delegation is recognised whatever each framework calls it', () => {
  const cases = [
    ['openai-agents', { type: 'handoff', from_agent: 'planner', to_agent: 'finance' }],
    ['claude-agents', { type: 'subagent', agent: 'planner', subagent_type: 'finance' }],
    ['crewai', { type: 'agent_delegated', from_agent: 'planner', to_agent: 'finance' }],
    ['autogen', { type: 'message', sender: 'planner', recipient: 'finance' }],
    ['a2a', { type: 'task.delegated', from: 'planner', to: 'finance' }]
  ];
  for (const [framework, event] of cases) {
    const normalized = normalize(framework, event);
    assert.equal(normalized.event, 'AGENT_DELEGATED', framework);
    assert.equal(normalized.subject, 'planner', framework);
    assert.equal(normalized.detail.to, 'finance', framework);
  }
});

test('MCP tool listings become capability discovery', () => {
  const normalized = normalize('mcp', { method: 'tools/list', server: 'payments', result: { tools: [{ name: 'payments.transfer' }, { name: 'payments.status' }] } });
  assert.equal(normalized.event, 'CAPABILITY_DISCOVERED');
  assert.deepEqual(normalized.detail.actions, ['payments.transfer', 'payments.status']);
});

test('framework events without security meaning are dropped, not invented', () => {
  assert.equal(normalize('openai-agents', { type: 'token_usage', tokens: 812 }), null);
  assert.equal(normalize('langgraph', { event: 'on_llm_new_token', data: { chunk: 'hel' } }), null);
  assert.equal(normalize('claude-agents', { type: 'text', text: 'thinking...' }), null);
  assert.equal(normalize('openai-agents', null), null); // malformed input must not lose the run
});

test('an unknown framework falls back to the generic envelope', () => {
  const normalized = normalize('some-new-framework-2027', { action: 'customers.delete', params: { recordsAffected: 900 } });
  assert.equal(normalized.detail.consequence, 'DATA_DELETED');
  assert.ok(supportedFrameworks().includes('generic'));
});

test('ingesting a run records proposals with the consequence they imply', () => {
  const timeline = createTimeline({ objective: 'Pay invoice' });
  ingest('openai-agents', [
    { type: 'agent_start', agent: 'planner', input: 'Pay invoice INV-4471' },
    { type: 'handoff', from_agent: 'planner', to_agent: 'finance' },
    { type: 'token_usage', tokens: 812 },
    { type: 'tool_call', name: 'payments.transfer', arguments: { amount: 18000 }, agent: 'finance' },
    { type: 'tool_output', name: 'payments.transfer', agent: 'finance' }
  ], timeline);

  const events = timeline.events.map((e) => e.event);
  assert.deepEqual(events, ['AGENT_STARTED', 'AGENT_DELEGATED', 'ACTION_PROPOSED', 'CONSEQUENCE_DETECTED', 'EXECUTION_COMPLETED']);
  assert.ok(replay(timeline).some((e) => e.line.includes('MONEY_MOVED (CRITICAL)')));
});
