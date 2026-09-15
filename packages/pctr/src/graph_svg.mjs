import { outgoing, pathsToAction, protectedActions } from './graph.mjs';
import { agentTrustNow } from './trust.mjs';
import { resolveRoute } from './router.mjs';

// THE GRAPH AS A PICTURE.
//
// This is the visual model of execution authority, not a decorative dashboard. It has to
// answer, at a glance: who participates, who delegated to whom, what tools they reach,
// what consequences those tools can cause, which route was selected, whose evidence is
// stale, and where authority is required. Anything that does not answer one of those
// questions does not belong in the drawing.

const THEME = {
  bg: '#0A0A0F', panel: '#12121A', border: '#1F1F2B', text: '#C9D1D9', dim: '#6E7681',
  principal: '#00D4FF', agent: '#00B8A9', tool: '#8892A0', route: '#00E676',
  CRITICAL: '#FF5470', HIGH: '#FFB300', MEDIUM: '#00D4FF', LOW: '#6E7681'
};

const COL = { principal: 40, agent: 250, tool: 500, action: 730 };
const NODE_W = { principal: 170, agent: 200, tool: 180, action: 240 };
const ROW_H = 64;
const TOP = 96;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const truncate = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

export function renderGraphSvg(graph, { action = null, at = new Date().toISOString() } = {}) {
  const agents = [...graph.nodes.values()].filter((n) => n.type === 'agent');
  const tools = [...graph.nodes.values()].filter((n) => n.type === 'tool');
  const actions = [...graph.nodes.values()].filter((n) => n.type === 'action');

  // If an action is named, draw its selected route in the foreground and dim the rest.
  const highlight = action ? highlightFor(graph, action) : null;

  const place = (items, column) => {
    const map = new Map();
    items.forEach((node, i) => map.set(node.id, { x: COL[column], y: TOP + i * ROW_H, w: NODE_W[column], node }));
    return map;
  };
  const positions = new Map([
    ...place([{ id: graph.principal, type: 'principal' }], 'principal'),
    ...place(agents, 'agent'), ...place(tools, 'tool'), ...place(actions, 'action')
  ]);

  const rows = Math.max(1, agents.length, tools.length, actions.length);
  const width = COL.action + NODE_W.action + 40;
  const height = TOP + rows * ROW_H + 70;

  const edges = [];
  for (const edge of graph.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to || edge.kind === 'causes') continue;
    const onRoute = highlight?.edges.has(`${edge.from}->${edge.to}`);
    edges.push(edgePath(from, to, edge.kind, onRoute, Boolean(highlight)));
  }

  const nodes = [];
  nodes.push(nodeBox(positions.get(graph.principal), 'principal', graph.principal, null, highlight));
  for (const agent of agents) {
    const trust = agentTrustNow(agent, { severity: 'HIGH', at });
    nodes.push(nodeBox(positions.get(agent.id), 'agent', agent.id,
      `${agent.framework ?? 'agent'} · trust ${trust.trust}${trust.evidenceStale ? ' · STALE' : ''}`,
      highlight, { stale: trust.evidenceStale }));
  }
  for (const tool of tools) {
    nodes.push(nodeBox(positions.get(tool.id), 'tool', tool.id, tool.protocol ?? 'local', highlight));
  }
  for (const act of actions) {
    nodes.push(nodeBox(positions.get(act.id), 'action', act.id, act.label,
      highlight, { severity: act.severity, protected: act.protected }));
  }

  const title = action
    ? `Execution authority for ${action}`
    : `Execution authority — ${agents.length} agents, ${tools.length} tools, ${protectedActions(graph).length} protected consequences`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(describeForScreenReader(graph, action, highlight))}">
  <rect width="${width}" height="${height}" fill="${THEME.bg}"/>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
    <text x="28" y="38" font-size="15" font-weight="700" fill="${THEME.text}">${esc(title)}</text>
    <text x="28" y="58" font-size="11" fill="${THEME.dim}">principal -> agents -> tools -> actions${highlight ? '   ·   the selected route is drawn in green' : ''}</text>
${edges.join('\n')}
${nodes.join('\n')}
${legend(width, height)}
  </g>
</svg>
`;
}

function highlightFor(graph, action) {
  const route = resolveRoute(graph, action);
  const path = route.selected?.path ?? pathsToAction(graph, action)[0] ?? [];
  const edges = new Set();
  for (let i = 0; i < path.length - 1; i++) edges.add(`${path[i]}->${path[i + 1]}`);
  return { nodes: new Set(path), edges, admissible: Boolean(route.selected), action };
}

function edgePath(from, to, kind, onRoute, dimOthers) {
  const x1 = from.x + from.w;
  const y1 = from.y + 18;
  const x2 = to.x;
  const y2 = to.y + 18;
  const mid = x1 + (x2 - x1) / 2;
  const stroke = onRoute ? THEME.route : THEME.border;
  const opacity = onRoute ? 1 : dimOthers ? 0.25 : 0.7;
  const dash = kind === 'uses' ? ' stroke-dasharray="4 3"' : '';
  return `    <path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${onRoute ? 2 : 1.2}" opacity="${opacity}"${dash}/>`;
}

function nodeBox(pos, type, id, subtitle, highlight, opts = {}) {
  if (!pos) return '';
  const onRoute = highlight?.nodes.has(id);
  const dimmed = highlight && !onRoute;
  const accent = type === 'action'
    ? (THEME[opts.severity] ?? THEME.dim)
    : THEME[type] ?? THEME.dim;
  const stroke = onRoute ? THEME.route : accent;
  const opacity = dimmed ? 0.35 : 1;
  const label = truncate(id.replace(/^spiffe:\/\//, ''), Math.floor(pos.w / 7.5));

  // A protected consequence gets a marker that survives being printed in black and white.
  const marker = opts.protected ? `      <text x="${pos.x + pos.w - 16}" y="${pos.y + 22}" font-size="13" font-weight="700" fill="${accent}">!</text>` : '';
  const staleMark = opts.stale
    ? `      <circle cx="${pos.x + pos.w - 14}" cy="${pos.y + 17}" r="5.5" fill="none" stroke="${THEME.HIGH}" stroke-width="1.5"/>
      <path d="M ${pos.x + pos.w - 14} ${pos.y + 13.5} L ${pos.x + pos.w - 14} ${pos.y + 17} L ${pos.x + pos.w - 11.5} ${pos.y + 18.5}" fill="none" stroke="${THEME.HIGH}" stroke-width="1.5" stroke-linecap="round"/>`
    : '';

  return `    <g opacity="${opacity}">
      <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${subtitle ? 40 : 30}" rx="6" fill="${THEME.panel}" stroke="${stroke}" stroke-width="${onRoute ? 2 : 1}"/>
      <rect x="${pos.x}" y="${pos.y}" width="3" height="${subtitle ? 40 : 30}" rx="1.5" fill="${accent}"/>
      <text x="${pos.x + 12}" y="${pos.y + 19}" font-size="12" font-weight="600" fill="${THEME.text}">${esc(label)}</text>
${subtitle ? `      <text x="${pos.x + 12}" y="${pos.y + 33}" font-size="10" fill="${THEME.dim}">${esc(truncate(subtitle, Math.floor(pos.w / 6)))}</text>` : ''}
${marker}${staleMark}
    </g>`;
}

function legend(width, height) {
  const y = height - 30;
  const items = [
    [THEME.agent, 'agent'], [THEME.tool, 'tool'],
    [THEME.CRITICAL, 'critical'], [THEME.HIGH, 'high'], [THEME.MEDIUM, 'medium'],
    [THEME.route, 'selected route']
  ];
  let x = 28;
  const parts = items.map(([color, label]) => {
    const part = `    <rect x="${x}" y="${y - 8}" width="9" height="9" rx="2" fill="${color}"/><text x="${x + 14}" y="${y}" font-size="10" fill="${THEME.dim}">${label}</text>`;
    x += 22 + label.length * 6;
    return part;
  });
  parts.push(`    <circle cx="${width - 340}" cy="${y - 4}" r="5" fill="none" stroke="${THEME.HIGH}" stroke-width="1.3"/>
    <path d="M ${width - 340} ${y - 7} L ${width - 340} ${y - 4} L ${width - 338} ${y - 2.5}" fill="none" stroke="${THEME.HIGH}" stroke-width="1.3" stroke-linecap="round"/>
    <text x="${width - 330}" y="${y}" font-size="10" fill="${THEME.dim}">= stale evidence</text>
    <text x="${width - 28}" y="${y}" font-size="10" text-anchor="end" fill="${THEME.dim}">! = protected consequence</text>`);
  return parts.join('\n');
}

// The picture has to be readable by something that cannot see it.
function describeForScreenReader(graph, action, highlight) {
  const agents = [...graph.nodes.values()].filter((n) => n.type === 'agent').length;
  const protectedCount = protectedActions(graph).length;
  if (action && highlight) {
    return highlight.admissible
      ? `Execution authority graph for ${action}. The selected route runs ${[...highlight.nodes].join(' then ')}.`
      : `Execution authority graph for ${action}. No admissible route reaches it.`;
  }
  return `Execution authority graph: ${agents} agents, ${protectedCount} protected consequences. Columns run principal, agents, tools, actions.`;
}

// Where an agent can reach, as text, for the cases a picture is the wrong medium.
export function reachSummary(graph, agentId) {
  const tools = outgoing(graph, agentId, 'uses');
  return tools.flatMap((tool) => outgoing(graph, tool, 'performs').map((action) => ({ tool, action })));
}
