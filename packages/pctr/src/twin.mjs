import { classifyAction, severityRank } from './consequences.mjs';
import { outgoing, pathsToAction } from './graph.mjs';

// CONSEQUENCE TWIN — see what your AI is about to change before it changes it.
// git diff / terraform plan / EXPLAIN, for autonomous agents.

export function previewConsequence(graph, actionId, params = {}) {
  const node = graph.nodes.get(actionId);
  const hints = { ...(node ?? {}), ...params };
  const c = classifyAction(actionId, hints);
  const recordsAffected = params.recordsAffected ?? node?.recordsAffected ?? null;
  const amount = params.amount ?? node?.amount ?? null;
  const routes = pathsToAction(graph, actionId);

  const affectedSystems = [...new Set(routes.map((p) => p[p.length - 2]).filter(Boolean))];
  const affectedIdentities = [...new Set(routes.flatMap((p) => p.slice(0, -2)))];
  const connectedWorkflows = node?.connectedWorkflows ?? affectedSystems.length;
  const downstream = outgoing(graph, actionId, 'triggers');

  const blastRadius = computeBlastRadius({ severity: c.severity, recordsAffected, connectedWorkflows, routes: routes.length });

  return {
    action: actionId,
    consequence: c.consequence,
    label: c.label,
    severity: c.severity,
    reversible: c.reversible,
    protected: c.protected,
    recordsAffected,
    financialExposure: amount,
    dataExposure: c.consequence === 'SECRET_EXPOSED' || c.consequence === 'DATA_READ' ? (params.dataClass ?? 'unknown') : null,
    affectedSystems,
    affectedIdentities,
    connectedWorkflows,
    downstreamDependencies: downstream,
    routesThatCanReachIt: routes.length,
    blastRadius,
    recommendations: recommend({ action: actionId, c, recordsAffected, amount, connectedWorkflows })
  };
}

function computeBlastRadius({ severity, recordsAffected, connectedWorkflows, routes }) {
  let score = severityRank(severity) * 20;
  if (recordsAffected) score += Math.min(40, Math.log10(recordsAffected + 1) * 12);
  score += Math.min(20, connectedWorkflows * 4);
  score += Math.min(20, routes * 4);
  const value = Math.round(Math.min(100, score));
  return { score: value, band: value >= 75 ? 'WIDE' : value >= 45 ? 'MODERATE' : 'NARROW' };
}

function recommend({ c, recordsAffected, amount, connectedWorkflows }) {
  const out = [];
  if (!c.reversible && c.protected) out.push('Require TTP execution authority bound to these exact parameters');
  if (recordsAffected > 25) out.push(`Limit batch to 25 records (currently ${recordsAffected}) + require approval`);
  if (amount >= 5000) out.push(`Require human approval: $${amount} exceeds the $5,000 policy limit`);
  if (connectedWorkflows > 2) out.push(`Notify ${connectedWorkflows} connected workflows before executing`);
  if (c.severity === 'CRITICAL') out.push('Verify authority at the effect boundary, not in the calling agent');
  return out.length ? out : ['No additional control required for this consequence class'];
}

// A change in material parameters can change the consequence — and therefore the route.
export function consequenceChanged(before, after) {
  return before.severity !== after.severity || before.consequence !== after.consequence ||
    before.financialExposure !== after.financialExposure || before.recordsAffected !== after.recordsAffected;
}
