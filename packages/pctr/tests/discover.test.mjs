import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { discover } from '../src/discover.mjs';
import { classifyAction } from '../src/consequences.mjs';
import { buildGraph, summarize } from '../src/graph.mjs';

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pctr-discover-'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

test('tool actions are read out of source, not guessed', () => {
  const dir = project({
    'package.json': JSON.stringify({ dependencies: { '@modelcontextprotocol/sdk': '^1.0.0' } }),
    'src/server.mjs': `
      const server = new McpServer({ name: 'payments' });
      server.tool('payments.transfer', 'Move money', async () => ({}));
      server.registerTool('customers.delete', 'Delete a customer', async () => ({}));
    `
  });
  const { manifest } = discover(dir);
  const actions = manifest.tools.flatMap((t) => t.actions);
  assert.ok(actions.includes('payments.transfer'));
  assert.ok(actions.includes('customers.delete'));
  assert.ok(manifest.frameworks.includes('mcp'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('python tool and agent declarations are discovered with the right framework', () => {
  const dir = project({
    'requirements.txt': 'crewai\nlangchain\n',
    'agents/finance.py': `
from crewai import Agent
from langchain.tools import tool

finance = Agent(role="Finance Agent", goal="pay invoices")

@tool
def send_invoice_email(to: str):
    return True
    `
  });
  const { manifest } = discover(dir);
  const agent = manifest.agents.find((a) => a.id === 'finance-agent');
  assert.ok(agent, 'expected the declared CrewAI agent');
  assert.equal(agent.framework, 'crewai');
  assert.ok(manifest.tools.flatMap((t) => t.actions).includes('send_invoice_email'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('MCP server configuration is discovered as external tooling', () => {
  const dir = project({ '.mcp.json': JSON.stringify({ mcpServers: { payments: { command: 'node', args: ['server.js'] } } }) });
  const { manifest } = discover(dir);
  const tool = manifest.tools.find((t) => t.id === 'payments');
  assert.equal(tool.protocol, 'mcp');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('declared facts in an existing manifest override what discovery inferred', () => {
  const dir = project({
    'package.json': JSON.stringify({ dependencies: { openai: '^4.0.0' } }),
    'src/agent.mjs': 'export const agent = {};'
  });
  const { manifest } = discover(dir, { declared: { principal: 'user:ops', agents: [{ id: 'agent', trust: 0.99, authority: ['payments.*'] }] } });
  const agent = manifest.agents.find((a) => a.id === 'agent');
  assert.equal(agent.trust, 0.99);
  assert.deepEqual(agent.authority, ['payments.*']);
  assert.equal(manifest.principal, 'user:ops');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the verb decides the consequence, not the namespace it sits in', () => {
  assert.equal(classifyAction('payments.status').consequence, 'DATA_READ');
  assert.equal(classifyAction('payments.transfer').consequence, 'MONEY_MOVED');
  assert.equal(classifyAction('customers.list').consequence, 'DATA_READ');
  assert.equal(classifyAction('customers.delete').consequence, 'DATA_DELETED');
  assert.equal(classifyAction('send_invoice_email').consequence, 'MESSAGE_SENT');
});

test('a discovered project produces a usable graph without any hand editing', () => {
  const dir = project({
    'package.json': JSON.stringify({ dependencies: { '@modelcontextprotocol/sdk': '^1.0.0' } }),
    'src/ops-agent.mjs': `
      const server = new McpServer({ name: 'infra' });
      server.tool('cluster.deploy', 'Deploy', async () => ({}));
    `
  });
  const { manifest } = discover(dir);
  const graph = buildGraph(manifest);
  const summary = summarize(graph);
  assert.ok(summary.agents >= 1);
  assert.ok(summary.protected >= 1, 'deploying to a cluster is a protected consequence');
  fs.rmSync(dir, { recursive: true, force: true });
});
