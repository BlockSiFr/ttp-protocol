import fs from 'node:fs';
import path from 'node:path';

// Agents are participants, not platforms. Discovery normalizes whatever a project
// happens to use into the universal agent envelope: agent, tool, action.

const FRAMEWORKS = [
  [/^openai$/, 'openai-agents'], [/^@openai\//, 'openai-agents'],
  [/^@anthropic-ai\//, 'claude-agents'], [/claude-agent-sdk/, 'claude-agents'],
  [/^@google\/|google-generativeai|google-genai/, 'google-agents'],
  [/langgraph/, 'langgraph'], [/^langchain|^@langchain\//, 'langchain'],
  [/crewai/, 'crewai'], [/autogen|pyautogen/, 'autogen'],
  [/semantic-kernel|semantic_kernel/, 'semantic-kernel'],
  [/^@modelcontextprotocol\/|^mcp$/, 'mcp'], [/a2a/, 'a2a']
];

const MCP_CONFIGS = ['.mcp.json', 'mcp.json', '.claude/settings.json', 'claude_desktop_config.json'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__', '.pctr']);
const SOURCE_FILE = /\.(m?[jt]sx?|py)$/;
const MAX_FILE_BYTES = 512 * 1024;

// Tool and agent declarations are written down in source; a running server is not
// needed to read them. These patterns cover how the common frameworks name things.
// Anything not matched is simply not discovered — never guessed.
const TOOL_PATTERNS = [
  /\b(?:server|mcp|app)\.(?:tool|registerTool)\s*\(\s*['"`]([\w.\-:/]+)['"`]/g,   // MCP servers (JS)
  /new\s+(?:DynamicStructuredTool|DynamicTool|Tool)\s*\(\s*\{\s*name\s*:\s*['"`]([\w.\-:/]+)['"`]/g, // LangChain
  /\btool\s*\(\s*\{\s*name\s*:\s*['"`]([\w.\-:/]+)['"`]/g,                    // OpenAI / generic tool()
  /['"`]?name['"`]?\s*:\s*['"`]([\w.\-:/]+)['"`]\s*,\s*['"`]?description['"`]?\s*:/g, // tool schema objects
  /@(?:mcp|server|app)\.tool\s*\([^)]*\)\s*(?:async\s+)?def\s+(\w+)/g,          // FastMCP (Python)
  /@tool\s*(?:\([^)]*\))?\s*(?:async\s+)?def\s+(\w+)/g,                          // LangChain (Python)
  /\bTool\s*\(\s*name\s*=\s*['"]([\w.\-:/]+)['"]/g                              // CrewAI / generic (Python)
];
const AGENT_PATTERNS = [
  /new\s+Agent\s*\(\s*\{[^}]*?name\s*:\s*['"`]([\w.\- ]+)['"`]/g,
  /\bAgent\s*\(\s*(?:role|name)\s*=\s*['"]([\w.\- ]+)['"]/g,
  /create(?:React|Tool[\w]*)?Agent\s*\(\s*\{[^}]*?name\s*:\s*['"`]([\w.\- ]+)['"`]/g,
  /\bAssistantAgent\s*\(\s*(?:name\s*=\s*)?['"]([\w.\- ]+)['"]/g
];

export function discover(cwd = process.cwd(), { declared = null } = {}) {
  const agents = new Map();
  const tools = new Map();
  const notes = [];

  for (const [name, framework] of detectFrameworks(cwd)) {
    notes.push(`${framework} detected via dependency "${name}"`);
  }
  const frameworks = [...new Set(detectFrameworks(cwd).map(([, f]) => f))];

  // Read the source once and take both agents and tool actions from it.
  const sources = findSourceFiles(cwd);
  const actionsByFile = new Map();
  for (const file of sources) {
    let text;
    try {
      if (fs.statSync(file).size > MAX_FILE_BYTES) continue;
      text = fs.readFileSync(file, 'utf8');
    } catch { continue; }

    const declaredActions = extractAll(TOOL_PATTERNS, text);
    if (declaredActions.length) actionsByFile.set(file, declaredActions);

    for (const name of extractAll(AGENT_PATTERNS, text)) {
      const id = slug(name);
      agents.set(id, { id, framework: frameworkFor(text, frameworks), source: path.relative(cwd, file), trust: 0.7, evidenceAgeSeconds: 0, authority: [], tools: [] });
      notes.push(`agent "${name}" declared in ${path.relative(cwd, file)}`);
    }
    if (/agent/i.test(path.basename(file)) && !extractAll(AGENT_PATTERNS, text).length) {
      const id = slug(path.basename(file).replace(SOURCE_FILE, ''));
      if (!agents.has(id)) agents.set(id, { id, framework: frameworkFor(text, frameworks), source: path.relative(cwd, file), trust: 0.7, evidenceAgeSeconds: 0, authority: [], tools: [] });
    }
  }

  for (const [file, actions] of actionsByFile) {
    const id = slug(path.basename(path.dirname(file)) === '.' ? 'local-tools' : `${path.basename(file).replace(SOURCE_FILE, '')}-tools`);
    tools.set(id, { id, protocol: 'local', actions: [...new Set(actions)], source: path.relative(cwd, file) });
    notes.push(`${actions.length} action(s) declared in ${path.relative(cwd, file)}`);
  }

  for (const cfg of MCP_CONFIGS) {
    const p = path.join(cwd, cfg);
    if (!fs.existsSync(p)) continue;
    let parsed; try { parsed = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    const servers = parsed.mcpServers ?? parsed.servers ?? {};
    for (const [name, def] of Object.entries(servers)) {
      tools.set(name, { id: name, protocol: 'mcp', actions: def.actions ?? [], source: cfg });
      notes.push(`MCP server "${name}" found in ${cfg}`);
    }
  }

  // Declared facts always win over inferred ones: a manifest is ground truth.
  // A discovered agent with no declared tools is assumed to reach the tools found
  // alongside it — an over-broad first draft is safer than an incomplete map, and the
  // manifest is there to be corrected.
  const toolIds = [...tools.keys()];
  for (const agent of agents.values()) if (!agent.tools.length) agent.tools = toolIds;

  const manifest = {
    version: 1,
    principal: declared?.principal ?? 'user:local',
    frameworks,
    agents: mergeById([...agents.values()], declared?.agents ?? []),
    tools: mergeById([...tools.values()], declared?.tools ?? []),
    actions: declared?.actions ?? [],
    policy: declared?.policy ?? defaultPolicy()
  };
  return { manifest, notes, discovered: { agents: agents.size, tools: tools.size } };
}

export const defaultPolicy = () => ({
  requireApprovalAtOrAbove: 'CRITICAL',
  maxHops: 6,
  decayPerHop: 0.05,
  approvalThresholds: { amount: 5000 }
});

function mergeById(inferred, declaredList) {
  const out = new Map(inferred.map((x) => [x.id, x]));
  for (const d of declaredList) out.set(d.id, { ...(out.get(d.id) ?? {}), ...d });
  return [...out.values()];
}

function detectFrameworks(cwd) {
  const found = [];
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
      for (const d of deps) for (const [re, f] of FRAMEWORKS) if (re.test(d)) found.push([d, f]);
    } catch { /* an unreadable package.json is not a discovery failure */ }
  }
  for (const f of ['requirements.txt', 'pyproject.toml']) {
    const p = path.join(cwd, f);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const [re, fw] of FRAMEWORKS) if (re.test(text) || new RegExp(re.source.replace(/[\^$]/g, ''), 'i').test(text)) found.push([f, fw]);
  }
  return found;
}

const slug = (name) => name.trim().toLowerCase().replace(/[_\s]+/g, '-').replace(/[^a-z0-9.\-]/g, '');

function extractAll(patterns, text) {
  const found = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) if (match[1]) found.push(match[1]);
  }
  return [...new Set(found)];
}

// What a file imports is better evidence than what the project depends on overall.
const FILE_FRAMEWORKS = [
  [/from\s+crewai|import\s+crewai/, 'crewai'],
  [/autogen/, 'autogen'],
  [/langgraph/, 'langgraph'],
  [/from\s+langchain|@langchain\//, 'langchain'],
  [/semantic[_-]kernel/, 'semantic-kernel'],
  [/agent-governance-toolkit|@microsoft\/agt|\bagt_sdk\b|\bagt\.(?:policy|client|agent)\b/, 'microsoft-agt'],
  [/@modelcontextprotocol\/|from\s+mcp/, 'mcp'],
  [/@anthropic-ai\/|claude[_-]agent/, 'claude-agents'],
  [/\bopenai\b/, 'openai-agents']
];
const frameworkFor = (text, frameworks) =>
  FILE_FRAMEWORKS.find(([re]) => re.test(text))?.[1] ?? frameworks[0] ?? 'unknown';

function findSourceFiles(cwd, depth = 0) {
  if (depth > 3) return [];
  let entries; try { entries = fs.readdirSync(cwd, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.claude') continue;
    const full = path.join(cwd, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) out.push(...findSourceFiles(full, depth + 1)); }
    else if (SOURCE_FILE.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(full);
  }
  return out;
}
