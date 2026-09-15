import { classifyAction, severityRank } from './consequences.mjs';

// The graph is the visual model of execution authority, not a decorative dashboard.
// Nodes: principal -> agents -> tools -> actions -> consequences.

export function buildGraph(manifest) {
  const nodes = new Map();
  const edges = [];
  const add = (id, type, data = {}) => {
    if (!nodes.has(id)) nodes.set(id, { id, type, ...data });
    else Object.assign(nodes.get(id), data);
    return nodes.get(id);
  };
  const link = (from, to, kind) => { edges.push({ from, to, kind }); };

  const principal = manifest.principal ?? 'principal:local';
  add(principal, 'principal');

  const toolById = new Map((manifest.tools ?? []).map((t) => [t.id, t]));
  const actionHints = new Map((manifest.actions ?? []).map((a) => [a.id, a]));

  for (const agent of manifest.agents ?? []) {
    add(agent.id, 'agent', {
      framework: agent.framework ?? 'unknown',
      trust: agent.trust ?? 0,
      evidenceAgeSeconds: agent.evidenceAgeSeconds ?? 0,
      jurisdiction: agent.jurisdiction ?? null,
      authority: agent.authority ?? [],
      latencyMs: agent.latencyMs ?? 0,
      costUnits: agent.costUnits ?? 0,
      available: agent.available !== false
    });
    if (agent.entry !== false && !(manifest.agents ?? []).some((a) => (a.delegatesTo ?? []).includes(agent.id))) {
      link(principal, agent.id, 'delegates');
    }
    for (const target of agent.delegatesTo ?? []) link(agent.id, target, 'delegates');
    for (const toolId of agent.tools ?? []) link(agent.id, toolId, 'uses');
  }

  for (const tool of manifest.tools ?? []) {
    add(tool.id, 'tool', { protocol: tool.protocol ?? 'local' });
    for (const actionId of tool.actions ?? []) {
      const hints = actionHints.get(actionId) ?? {};
      const c = classifyAction(actionId, hints);
      add(actionId, 'action', { ...c, ...hints });
      link(tool.id, actionId, 'performs');
      const consequenceId = `consequence:${c.consequence}`;
      add(consequenceId, 'consequence', { class: c.consequence, label: c.label, severity: c.severity });
      link(actionId, consequenceId, 'causes');
    }
  }

  return { principal, nodes, edges, manifest };
}

export const outgoing = (graph, id, kind) =>
  graph.edges.filter((e) => e.from === id && (!kind || e.kind === kind)).map((e) => e.to);
export const incoming = (graph, id, kind) =>
  graph.edges.filter((e) => e.to === id && (!kind || e.kind === kind)).map((e) => e.from);

// Forward: what consequential state changes can this agent eventually reach?
export function reachableActions(graph, agentId, seen = new Set()) {
  if (seen.has(agentId)) return [];
  seen.add(agentId);
  const found = [];
  for (const toolId of outgoing(graph, agentId, 'uses')) {
    for (const actionId of outgoing(graph, toolId, 'performs')) found.push({ actionId, toolId, via: [agentId] });
  }
  for (const next of outgoing(graph, agentId, 'delegates')) {
    for (const r of reachableActions(graph, next, seen)) found.push({ ...r, via: [agentId, ...r.via] });
  }
  return found;
}

// Inverse: consequence <- action <- tool <- agent <- delegation <- principal.
// Every distinct path that can arrive at this consequence.
export function pathsToAction(graph, actionId) {
  const toolIds = incoming(graph, actionId, 'performs');
  const paths = [];
  const walkBack = (agentId, tail, seen) => {
    if (seen.has(agentId)) return;
    const next = new Set(seen).add(agentId);
    const path = [agentId, ...tail];
    const delegators = incoming(graph, agentId, 'delegates');
    if (!delegators.length) { paths.push([graph.principal, ...path]); return; }
    for (const d of delegators) {
      if (d === graph.principal) paths.push([graph.principal, ...path]);
      else walkBack(d, path, next);
    }
  };
  for (const toolId of toolIds) {
    for (const agentId of incoming(graph, toolId, 'uses')) walkBack(agentId, [toolId, actionId], new Set());
  }
  return paths;
}

export function protectedActions(graph) {
  return [...graph.nodes.values()]
    .filter((n) => n.type === 'action' && n.protected)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.id.localeCompare(b.id));
}

export function summarize(graph) {
  const counts = { agents: 0, tools: 0, actions: 0, consequences: 0 };
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const n of graph.nodes.values()) {
    if (n.type === 'agent') counts.agents++;
    if (n.type === 'tool') counts.tools++;
    if (n.type === 'action') { counts.actions++; bySeverity[n.severity]++; }
    if (n.type === 'consequence') counts.consequences++;
  }
  const externalSystems = new Set(
    [...graph.nodes.values()].filter((n) => n.type === 'tool' && n.protocol !== 'local').map((n) => n.id)
  ).size;
  return { ...counts, externalSystems, bySeverity, protected: protectedActions(graph).length };
}
