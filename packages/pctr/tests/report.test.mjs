import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/graph.mjs';
import { renderReport, badgeUrl } from '../src/report.mjs';

const manifestOf = (overrides = {}) => ({
  principal: 'user:test',
  agents: [{ id: 'support', trust: 0.8, evidenceAgeSeconds: 10, authority: ['customers.read'], tools: ['db'], delegatesTo: ['admin'] },
    { id: 'admin', trust: 0.95, evidenceAgeSeconds: 10, authority: ['customers.*'], tools: ['db'] }],
  tools: [{ id: 'db', protocol: 'mcp', actions: ['customers.delete', 'customers.read'] }],
  actions: [{ id: 'customers.delete', recordsAffected: 1842, connectedWorkflows: 4 }],
  ...overrides
});
const graph = (overrides = {}) => buildGraph(manifestOf(overrides));

test('the shared report leads with the consequence, not with agent counts', () => {
  const report = renderReport(graph());
  assert.match(report, /Highest priority: `customers\.delete`/);
  assert.match(report, /\*\*data deleted\*\*/);
  assert.match(report, /\*\*irreversible\*\*/);
  assert.match(report, /1,842 records/);
  assert.match(report, /CRITICAL/);
});

test('the report renders as valid Markdown a PR comment can hold', () => {
  const report = renderReport(graph());
  assert.ok(report.startsWith('## '), 'starts with a heading');
  assert.equal((report.match(/```/g) ?? []).length % 2, 0, 'code fences are balanced');
  assert.equal((report.match(/<details>/g) ?? []).length, (report.match(/<\/details>/g) ?? []).length);
  assert.ok(report.includes('Nothing left this machine.'));
  assert.ok(report.length < 60_000, 'fits inside a GitHub comment');
});

test('a clean project gets a green badge and an honest all-clear', () => {
  const clean = buildGraph({
    principal: 'user:test',
    agents: [{ id: 'reader', trust: 0.9, authority: ['reports.read'], tools: ['reports'] }],
    tools: [{ id: 'reports', actions: ['reports.read'] }]
  });
  const report = renderReport(clean);
  assert.match(report, /None of them can cause a protected consequence/);
  assert.match(badgeUrl(clean), /brightgreen/);
});

test('an empty scan says so rather than inventing findings', () => {
  const empty = buildGraph({ principal: 'user:test', agents: [], tools: [] });
  const report = renderReport(empty);
  assert.match(report, /found no agents to scan/);
  assert.doesNotMatch(report, /Highest priority/);
});

test('the badge reflects what was actually found', () => {
  assert.match(badgeUrl(graph()), /1%20critical%20consequence-critical/);
});

test('example data is never presented as findings about the reader\'s project', () => {
  const example = buildGraph(manifestOf({ example: true }));
  const report = renderReport(example);
  assert.match(report, /\*\*Example data\.\*\* These agents are made up/);
  assert.ok(report.indexOf('Example data') < report.indexOf('Highest priority'),
    'the warning must come before anything that reads as a finding');
});
