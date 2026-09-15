#!/usr/bin/env node
// The PCTR <-> AGT bridge exists twice: packages/pctr/src/agt.mjs for JavaScript and
// sdk/python/agt.py for Python, because AGT is Python-first. Two implementations agree
// only as long as something checks, so this runs both over the same inputs and fails on
// any divergence. Run: node scripts/check-agt-parity.mjs
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyAction } from '../packages/pctr/src/consequences.mjs';
import { trustTier, toAgtScore, ringForSeverity, domainFor, normalizeAgtEvent } from '../packages/pctr/src/agt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// One shared corpus, exercised by both implementations.
const ACTIONS = [
  ['payments.status', {}], ['payments.transfer', {}], ['payments.transfer', { amount: 18000 }],
  ['customers.delete', {}], ['records.update', { recordsAffected: 5000 }], ['send_invoice_email', {}],
  ['reports.read', {}], ['cluster.deploy', {}], ['vault.read', {}], ['nothing.special', {}]
];
const SCORES = [0, 0.1, 0.29, 0.3, 0.6, 0.849, 0.85, 0.9178, 1];
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', '?'];
const CONSEQUENCES = ['MONEY_MOVED', 'DATA_DELETED', 'SECRET_EXPOSED', 'SOMETHING_NEW'];
const EVENTS = [
  ['policy-allow', { allowed: true, action: 'allow', agentId: 'f', operation: 'reports.read', approvers: [], rateLimited: false }],
  ['policy-warn', { allowed: true, action: 'warn', agentId: 'f', operation: 'reports.read', approvers: [], rateLimited: false }],
  ['policy-deny', { allowed: false, action: 'deny', agentId: 'f', operation: 'payments.transfer', approvers: [], rateLimited: false }],
  ['policy-approval', { allowed: true, action: 'require_approval', agentId: 'f', operation: 'payments.transfer', approvers: ['ops'], rateLimited: false }],
  ['audit-review', { timestamp: 't', agentId: 'f', action: 'customers.delete', decision: 'review', hash: 'h1', previousHash: 'h0' }],
  ['audit-allow', { timestamp: 't', agentId: 'f', action: 'reports.read', decision: 'allow', hash: 'h1', previousHash: 'h0' }],
  ['cascade-quarantine', { eventId: 'e1', timestamp: 't', sourceAgentId: 'f', affectedAgentIds: ['a'], action: 'agent_quarantined', reason: 'b', blastRadius: 3 }],
  ['cascade-health', { eventId: 'e2', timestamp: 't', sourceAgentId: 'f', affectedAgentIds: [], action: 'health_propagated' }],
  ['ring-violation', { agentId: 'f', action: 'prod.deploy', agentRing: 2, requiredRing: 0, message: 'm' }],
  ['trust-verify', { verified: false, agentId: 'f', trustScore: { overall: 0.42, dimensions: {}, tier: 'Provisional' } }],
  ['invocation', { type: 'action.invocation', agentId: 'f', action: 'payments.transfer', parameters: { amount: 18000 } }],
  ['registration', { type: 'agent.registered', agentId: 'f', trustScore: { overall: 0.97, dimensions: {}, tier: 'Verified' } }],
  ['delegation', { type: 'task.delegated', agentId: 'f', to: 'g' }],
  ['junk', { type: 'telemetry.heartbeat', agentId: 'f' }],
  ['malformed', { nothing: 'useful' }]
];

const key = (score) => (Number.isInteger(score) ? String(score) : String(score));

function javascript() {
  const out = { classify: {}, tiers: {}, scores: {}, rings: {}, domains: {}, events: {} };
  for (const [action, params] of ACTIONS) {
    const c = classifyAction(action, params);
    out.classify[`${action}|${JSON.stringify(params)}`] = [c.consequence, c.severity, c.reversible];
  }
  for (const score of SCORES) { out.tiers[key(score)] = trustTier(score); out.scores[key(score)] = toAgtScore(score); }
  for (const severity of SEVERITIES) out.rings[severity] = ringForSeverity(severity);
  for (const consequence of CONSEQUENCES) out.domains[consequence] = domainFor(consequence);
  for (const [name, event] of EVENTS) {
    const r = normalizeAgtEvent(event);
    out.events[name] = r ? [r.event, r.subject ?? null] : null;
  }
  return out;
}

const PY = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(root, 'sdk', 'python'))})
from agt import classify_action, trust_tier, to_agt_score, ring_for_severity, domain_for, normalize_agt_event

actions = json.loads(${JSON.stringify(JSON.stringify(ACTIONS))})
scores = json.loads(${JSON.stringify(JSON.stringify(SCORES))})
severities = json.loads(${JSON.stringify(JSON.stringify(SEVERITIES))})
consequences = json.loads(${JSON.stringify(JSON.stringify(CONSEQUENCES))})
events = json.loads(${JSON.stringify(JSON.stringify(EVENTS))})

out = {'classify': {}, 'tiers': {}, 'scores': {}, 'rings': {}, 'domains': {}, 'events': {}}
for action, params in actions:
    c = classify_action(action, params)
    out['classify'][action + '|' + json.dumps(params, separators=(',', ':'))] = [c['consequence'], c['severity'], c['reversible']]
for score in scores:
    k = str(int(score)) if float(score).is_integer() else str(score)
    out['tiers'][k] = trust_tier(score)
    out['scores'][k] = to_agt_score(score)
for severity in severities:
    out['rings'][severity] = ring_for_severity(severity)
for consequence in consequences:
    out['domains'][consequence] = domain_for(consequence)
for name, event in events:
    r = normalize_agt_event(event)
    out['events'][name] = [r['event'], r.get('subject')] if r else None
print(json.dumps(out))
`;

function python() {
  const stdout = execFileSync('python3', ['-c', PY], { encoding: 'utf8', cwd: root });
  return JSON.parse(stdout);
}

const js = javascript();
const py = python();

const differences = [];
let checks = 0;
for (const section of Object.keys(js)) {
  for (const [name, value] of Object.entries(js[section])) {
    checks++;
    const other = py[section]?.[name];
    if (JSON.stringify(value) !== JSON.stringify(other)) {
      differences.push(`  ${section}.${name}\n      js:     ${JSON.stringify(value)}\n      python: ${JSON.stringify(other)}`);
    }
  }
}

if (differences.length) {
  console.error(`PCTR/AGT bridge parity FAILED — ${differences.length} of ${checks} checks differ:\n`);
  console.error(differences.join('\n'));
  console.error('\npackages/pctr/src/agt.mjs and sdk/python/agt.py must agree. Fix both.');
  process.exit(1);
}
console.log(`PCTR/AGT bridge parity OK — JavaScript and Python agree across ${checks} checks.`);
