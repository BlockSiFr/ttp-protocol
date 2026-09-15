import { outgoing } from './graph.mjs';
import { agentTrustNow } from './trust.mjs';

// Discovery is an observed security event too: what exists, who delegated to whom, and
// what each participant can reach. This is what turns a static graph into a run.
export function recordDiscovery(graph, timeline) {
  const agents = [...graph.nodes.values()].filter((n) => n.type === 'agent');
  for (const agent of agents) {
    const discovered = timeline.record('AGENT_DISCOVERED',
      { framework: agent.framework, trust: agent.trust, authority: agent.authority }, { subject: agent.id });
    for (const target of outgoing(graph, agent.id, 'delegates')) {
      timeline.record('AGENT_DELEGATED', { to: target }, { subject: agent.id, because: [discovered.id] });
    }
    for (const toolId of outgoing(graph, agent.id, 'uses')) {
      const actions = outgoing(graph, toolId, 'performs');
      timeline.record('CAPABILITY_DISCOVERED',
        { tool: toolId, actions, protocol: graph.nodes.get(toolId)?.protocol ?? 'local' },
        { subject: agent.id, because: [discovered.id] });
    }
  }
  return timeline;
}

// Trust is observed, not assumed. Comparing the trust state behind the previously
// selected route with the state now is what makes TRUST_CHANGED real rather than decorative.
export function trustDelta(previousStates = [], currentStates = []) {
  const before = new Map(previousStates.map((t) => [t.agentId, t]));
  const changes = [];
  for (const now of currentStates) {
    const was = before.get(now.agentId);
    if (!was) continue;
    if (was.trust !== now.trust || was.evidenceStale !== now.evidenceStale) {
      changes.push({
        agentId: now.agentId, from: was.trust, to: now.trust,
        becameStale: !was.evidenceStale && now.evidenceStale,
        reason: !was.evidenceStale && now.evidenceStale
          ? `evidence for ${now.agentId} aged past the ${now.maxEvidenceAgeSeconds}s limit for this consequence`
          : `trust for ${now.agentId} moved from ${was.trust} to ${now.trust}`
      });
    }
  }
  return changes;
}

export { agentTrustNow };
