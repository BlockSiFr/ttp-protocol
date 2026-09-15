import { classifyAction } from './consequences.mjs';

// UNIVERSAL AGENT ENVELOPE.
// Agents are participants, not platforms. An adapter normalizes security *meaning* —
// who is acting, who delegated, what capability appeared, what action is proposed —
// and deliberately drops framework internals. A new framework needs an adapter here,
// not a change to PCTR.

const str = (...candidates) => candidates.find((c) => typeof c === 'string' && c.length) ?? null;

// Each adapter maps one framework event to { event, subject, detail } or null when the
// event carries no security meaning. Returning null is a valid, common answer.
export const adapters = {
  'openai-agents': (e) => {
    switch (e.type) {
      case 'agent_start': case 'run_start':
        return { event: 'AGENT_STARTED', subject: str(e.agent, e.agent_name, e.name), detail: { objective: str(e.input, e.objective) } };
      case 'handoff': case 'agent_handoff':
        return { event: 'AGENT_DELEGATED', subject: str(e.from_agent, e.source, e.agent), detail: { to: str(e.to_agent, e.target) } };
      case 'tool_call': case 'function_call':
        return proposal(str(e.name, e.tool_name, e.function?.name), e.arguments ?? e.args ?? e.input, str(e.agent, e.agent_name));
      case 'tool_output': case 'function_result':
        return { event: 'EXECUTION_COMPLETED', subject: str(e.agent, e.agent_name), detail: { action: str(e.name, e.tool_name), status: e.error ? 'FAILED' : 'SUCCEEDED' } };
      default: return null;
    }
  },

  'claude-agents': (e) => {
    switch (e.type) {
      case 'system': case 'init':
        return { event: 'AGENT_STARTED', subject: str(e.session_id, e.agent), detail: { objective: str(e.prompt, e.objective) } };
      case 'tool_use':
        return proposal(str(e.name, e.tool), e.input, str(e.agent, e.session_id));
      case 'tool_result':
        return { event: 'EXECUTION_COMPLETED', subject: str(e.agent, e.session_id), detail: { action: str(e.name, e.tool), status: e.is_error ? 'FAILED' : 'SUCCEEDED' } };
      case 'subagent': case 'task':
        return { event: 'AGENT_DELEGATED', subject: str(e.agent, e.parent, e.session_id), detail: { to: str(e.subagent_type, e.to, e.description) } };
      default: return null;
    }
  },

  langgraph: (e) => {
    switch (str(e.event, e.type)) {
      case 'on_chain_start': case 'on_graph_start':
        return { event: 'AGENT_STARTED', subject: str(e.name, e.node), detail: { objective: str(e.data?.input?.objective, e.data?.input) } };
      case 'on_tool_start':
        return proposal(str(e.name, e.data?.name), e.data?.input, str(e.metadata?.langgraph_node, e.parent_ids?.at(-1)));
      case 'on_tool_end':
        return { event: 'EXECUTION_COMPLETED', subject: str(e.metadata?.langgraph_node), detail: { action: str(e.name), status: 'SUCCEEDED' } };
      // A node handing to another node is delegation, whatever the graph calls it.
      case 'on_node_start':
        return e.metadata?.from
          ? { event: 'AGENT_DELEGATED', subject: str(e.metadata.from), detail: { to: str(e.name, e.node) } }
          : null;
      default: return null;
    }
  },

  crewai: (e) => {
    switch (str(e.type, e.event)) {
      case 'crew_kickoff': case 'task_started':
        return { event: 'AGENT_STARTED', subject: str(e.agent, e.agent_role), detail: { objective: str(e.task, e.description) } };
      case 'agent_delegated': case 'delegation':
        return { event: 'AGENT_DELEGATED', subject: str(e.from_agent, e.agent), detail: { to: str(e.to_agent, e.coworker) } };
      case 'tool_usage_started':
        return proposal(str(e.tool, e.tool_name), e.tool_args ?? e.input, str(e.agent, e.agent_role));
      case 'tool_usage_finished':
        return { event: 'EXECUTION_COMPLETED', subject: str(e.agent, e.agent_role), detail: { action: str(e.tool, e.tool_name), status: 'SUCCEEDED' } };
      default: return null;
    }
  },

  autogen: (e) => {
    switch (str(e.type, e.event)) {
      case 'message': case 'chat_message':
        // A message that hands work to another participant is a delegation.
        return e.recipient && e.sender !== e.recipient
          ? { event: 'AGENT_DELEGATED', subject: str(e.sender), detail: { to: str(e.recipient) } }
          : null;
      case 'function_call': case 'tool_call':
        return proposal(str(e.name, e.function?.name), e.arguments ?? e.function?.arguments, str(e.sender, e.agent));
      case 'function_result': case 'tool_response':
        return { event: 'EXECUTION_COMPLETED', subject: str(e.sender, e.agent), detail: { action: str(e.name), status: 'SUCCEEDED' } };
      default: return null;
    }
  },

  'semantic-kernel': (e) => {
    switch (str(e.type, e.event)) {
      case 'function_invoking':
        return proposal(str(e.function, e.name, e.function_name), e.arguments, str(e.plugin, e.agent));
      case 'function_invoked':
        return { event: 'EXECUTION_COMPLETED', subject: str(e.plugin, e.agent), detail: { action: str(e.function, e.name), status: 'SUCCEEDED' } };
      default: return null;
    }
  },

  // MCP speaks JSON-RPC: tools/list is capability discovery, tools/call is a proposal.
  mcp: (e) => {
    const method = str(e.method, e.type);
    if (method === 'tools/list' || method === 'list_tools') {
      const tools = (e.result?.tools ?? e.tools ?? []).map((t) => str(t.name, t)).filter(Boolean);
      return { event: 'CAPABILITY_DISCOVERED', subject: str(e.server, e.serverName), detail: { tool: str(e.server, e.serverName), actions: tools, protocol: 'mcp' } };
    }
    if (method === 'tools/call' || method === 'call_tool') {
      return proposal(str(e.params?.name, e.name), e.params?.arguments ?? e.arguments, str(e.client, e.server));
    }
    return null;
  },

  a2a: (e) => {
    switch (str(e.type, e.event)) {
      case 'task.delegated': case 'task/delegate':
        return { event: 'AGENT_DELEGATED', subject: str(e.from, e.source_agent), detail: { to: str(e.to, e.target_agent) } };
      case 'task.submitted': case 'task/send':
        return { event: 'AGENT_STARTED', subject: str(e.agent, e.to), detail: { objective: str(e.message, e.task?.description) } };
      case 'task.completed':
        return { event: 'EXECUTION_COMPLETED', subject: str(e.agent), detail: { action: str(e.task?.name, e.name), status: 'SUCCEEDED' } };
      default: return null;
    }
  },

  // Anything can speak the envelope directly.
  generic: (e) => {
    const action = str(e.action, e.tool, e.name);
    if (e.event === 'delegate' || e.delegatesTo) return { event: 'AGENT_DELEGATED', subject: str(e.agent, e.from), detail: { to: str(e.delegatesTo, e.to) } };
    return action ? proposal(action, e.params ?? e.arguments, str(e.agent)) : null;
  }
};

// A proposed action is where consequence classification happens, so every framework
// gets the same answer to "what can this cause?" from the same rules.
function proposal(action, args, agent) {
  if (!action) return null;
  const params = typeof args === 'string' ? tryParse(args) : (args ?? {});
  const consequence = classifyAction(action, params);
  return { event: 'ACTION_PROPOSED', subject: agent, detail: { action, ...params, consequence: consequence.consequence, severity: consequence.severity } };
}

const tryParse = (s) => { try { return JSON.parse(s); } catch { return {}; } };

export const supportedFrameworks = () => Object.keys(adapters);

export function normalize(framework, event) {
  const adapter = adapters[framework] ?? adapters.generic;
  try {
    return adapter(event) ?? null;
  } catch {
    return null; // A malformed framework event is not a reason to lose the run.
  }
}

// Feed a framework's event stream into a timeline. Proposals also record the
// consequence they imply, because that is the part every framework leaves out.
export function ingest(framework, events, timeline, { because = [] } = {}) {
  const recorded = [];
  let lastId = because;
  for (const raw of events) {
    const normalized = normalize(framework, raw);
    if (!normalized) continue;
    const entry = timeline.record(normalized.event, normalized.detail, { subject: normalized.subject, because: lastId });
    recorded.push(entry);
    lastId = [entry.id];
    if (normalized.event === 'ACTION_PROPOSED' && normalized.detail.consequence && normalized.detail.consequence !== 'NONE') {
      const detected = timeline.record('CONSEQUENCE_DETECTED',
        { consequence: normalized.detail.consequence, severity: normalized.detail.severity, action: normalized.detail.action },
        { subject: normalized.subject, because: [entry.id] });
      recorded.push(detected);
      lastId = [detected.id];
    }
  }
  return recorded;
}
