import { classifyAction, severityRank } from './consequences.mjs';
import { resolveRoute } from './router.mjs';

// LEARN — the step that closes the loop.
//
// Every protected execution leaves evidence behind: what was proposed, what it turned
// out to affect, which routes were rejected and why, what a human approved. Without this
// step that evidence just accumulates. With it, the graph, the policy and the discovery
// map get better the longer the system runs, which is the whole claim.
//
// Findings are proposals, never silent edits. Each one carries the evidence it came from
// so a human can disagree with it.

const HIGH = 'HIGH', MEDIUM = 'MEDIUM', LOW = 'LOW';

export function learn({ graph, receipts = [], runs = [], policy = {} } = {}) {
  const effectivePolicy = { ...(graph?.manifest?.policy ?? {}), ...policy };
  const findings = [
    ...undeclaredActions(graph, receipts, runs),
    ...misdeclaredConsequences(graph, receipts),
    ...chronicStaleEvidence(graph, receipts, runs),
    ...unusedAuthority(graph, receipts),
    ...approvalPatterns(receipts, effectivePolicy),
    ...unreachableProtectedActions(graph),
    ...repeatedDenials(receipts)
  ];
  return {
    observations: { receipts: receipts.length, runs: runs.length, actions: countActions(receipts).size },
    findings: findings.sort((a, b) => weight(b) - weight(a)),
    proposal: toManifestProposal(graph, findings)
  };
}

const weight = (f) => ({ HIGH: 2, MEDIUM: 1, LOW: 0 }[f.confidence] ?? 0) * 10 + (f.occurrences ?? 1);

// An action PCTR executed but the manifest never declared: the map is incomplete, and an
// undeclared action is one nobody chose to protect.
function undeclaredActions(graph, receipts, runs) {
  if (!graph) return [];
  const declared = new Set([...graph.nodes.values()].filter((n) => n.type === 'action').map((n) => n.id));
  const seen = new Map();
  const toolFor = new Map();
  for (const [action, count] of countActions(receipts)) if (!declared.has(action)) seen.set(action, count);
  // A declared action with no tool never enters the graph, so recover the tool from the
  // route the receipt recorded where we can.
  for (const receipt of receipts) {
    const action = receipt.requested?.action;
    const hops = receipt.routeSelected?.routeId?.split(' -> ') ?? [];
    if (action && seen.has(action) && hops.length >= 2) toolFor.set(action, hops.at(-2));
  }
  for (const run of runs) {
    for (const event of run.events ?? []) {
      const action = event.detail?.action;
      if (action && !declared.has(action)) seen.set(action, (seen.get(action) ?? 0) + 1);
    }
  }
  return [...seen].map(([action, occurrences]) => {
    const c = classifyAction(action);
    return {
      type: 'UNDECLARED_ACTION', action, occurrences,
      confidence: c.protected ? HIGH : MEDIUM,
      summary: `${action} has executed ${occurrences}× but is not in pctr.json`,
      detail: [
        c.protected
          ? `It can cause "${c.label}" (${c.severity}) and is currently outside every policy you have written.`
          : `It appears to be ${c.label}; declaring it keeps the map complete.`,
        toolFor.has(action) ? null : 'No tool could be inferred from the receipts, so you will need to say which tool performs it.'
      ].filter(Boolean).join(' '),
      proposal: { addAction: { id: action, tool: toolFor.get(action) ?? null } }
    };
  });
}

// The consequence that was declared versus the one the parameters actually showed.
function misdeclaredConsequences(graph, receipts) {
  if (!graph) return [];
  const findings = [];
  const observed = new Map();
  for (const receipt of receipts) {
    const action = receipt.requested?.action;
    const records = receipt.requested?.params?.recordsAffected;
    const amount = receipt.requested?.params?.amount;
    if (!action || (records == null && amount == null)) continue;
    const entry = observed.get(action) ?? { records: [], amounts: [] };
    if (records != null) entry.records.push(records);
    if (amount != null) entry.amounts.push(amount);
    observed.set(action, entry);
  }
  for (const [action, entry] of observed) {
    const node = graph.nodes.get(action);
    if (!node) continue;
    const maxRecords = Math.max(0, ...entry.records);
    const maxAmount = Math.max(0, ...entry.amounts);
    const declaredRecords = node.recordsAffected ?? 0;
    const declaredAmount = node.amount ?? 0;

    if (maxRecords > declaredRecords * 2 && maxRecords > 50) {
      findings.push({
        type: 'UNDERSTATED_CONSEQUENCE', action, occurrences: entry.records.length, confidence: HIGH,
        summary: `${action} declares ${declaredRecords || 'no'} records but has affected up to ${maxRecords.toLocaleString('en-US')}`,
        detail: `Severity is computed from that number, so the declared value has been under-protecting this action.`,
        proposal: { updateAction: { id: action, recordsAffected: maxRecords } }
      });
    }
    if (maxAmount > declaredAmount * 2 && maxAmount > 100) {
      findings.push({
        type: 'UNDERSTATED_CONSEQUENCE', action, occurrences: entry.amounts.length, confidence: HIGH,
        summary: `${action} declares $${declaredAmount} but has moved up to $${maxAmount.toLocaleString('en-US')}`,
        detail: 'Approval thresholds key off this, so the declared value has been under-protecting this action.',
        proposal: { updateAction: { id: action, amount: maxAmount } }
      });
    }
  }
  return findings;
}

// An agent whose evidence is repeatedly stale is not a routing problem to work around;
// it is an attestation pipeline that is not running.
function chronicStaleEvidence(graph, receipts, runs) {
  const stale = new Map();
  for (const run of runs) {
    for (const event of run.events ?? []) {
      if (event.event === 'TRUST_CHANGED' && event.detail?.becameStale) {
        stale.set(event.subject, (stale.get(event.subject) ?? 0) + 1);
      }
      if (event.event === 'ROUTE_INVALIDATED' && /evidence is \d+s old/.test(event.detail?.reason ?? '')) {
        const agent = /(\S+) evidence is/.exec(event.detail.reason)?.[1];
        if (agent) stale.set(agent, (stale.get(agent) ?? 0) + 1);
      }
    }
  }
  return [...stale].filter(([, n]) => n >= 2).map(([agent, occurrences]) => ({
    type: 'CHRONIC_STALE_EVIDENCE', agent, occurrences, confidence: HIGH,
    summary: `${agent} has been rejected ${occurrences}× for stale evidence`,
    detail: 'Routing around it each time hides the real problem: its attestation is not being refreshed.',
    proposal: null
  }));
}

// Authority nobody has used is authority nobody needs.
function unusedAuthority(graph, receipts) {
  if (!graph || receipts.length < 5) return [];   // too little evidence to claim anything
  const used = new Set();
  for (const receipt of receipts) for (const agent of receipt.routeSelected?.agents ?? []) {
    used.add(`${agent}::${receipt.requested?.action}`);
  }
  const findings = [];
  for (const node of graph.nodes.values()) {
    if (node.type !== 'agent') continue;
    const wildcard = (node.authority ?? []).filter((a) => a === '*');
    if (!wildcard.length) continue;
    const actionsUsed = [...used].filter((k) => k.startsWith(`${node.id}::`)).map((k) => k.split('::')[1]);
    findings.push({
      type: 'BROAD_AUTHORITY', agent: node.id, occurrences: actionsUsed.length, confidence: actionsUsed.length ? MEDIUM : HIGH,
      summary: `${node.id} holds authority "*" but has only ever used ${actionsUsed.length || 'none'}`,
      detail: actionsUsed.length
        ? `Observed: ${[...new Set(actionsUsed)].join(', ')}. Narrowing authority to what it actually does shrinks the blast radius.`
        : 'It has executed nothing. A wildcard on an unused agent is pure exposure.',
      proposal: actionsUsed.length ? { updateAgent: { id: node.id, authority: [...new Set(actionsUsed)] } } : null
    });
  }
  return findings;
}

// Approval that is always granted is a rubber stamp; approval never granted is a wall.
// Both are policy telling you something.
function approvalPatterns(receipts, policy) {
  const byAction = new Map();
  for (const receipt of receipts) {
    const action = receipt.requested?.action;
    if (!action) continue;
    const needed = (receipt.authorityBound?.constraints?.requiresApproval) ||
      (receipt.verifier?.failures ?? []).some((f) => f.code === 'APPROVAL_REQUIRED');
    if (!needed) continue;
    const entry = byAction.get(action) ?? { granted: 0, refused: 0 };
    if (receipt.verifier?.decision === 'EXECUTION_ALLOWED') entry.granted++; else entry.refused++;
    byAction.set(action, entry);
  }
  const findings = [];
  for (const [action, { granted, refused }] of byAction) {
    const total = granted + refused;
    if (total < 4) continue;
    if (granted === total) {
      findings.push({
        type: 'APPROVAL_ALWAYS_GRANTED', action, occurrences: total, confidence: MEDIUM,
        summary: `${action} has required approval ${total}× and been approved every time`,
        detail: 'An approval that is never refused trains people to click through it. Either raise the threshold so it fires less, or add a constraint that makes the approval meaningful.',
        proposal: null
      });
    }
    if (refused === total) {
      findings.push({
        type: 'APPROVAL_NEVER_GRANTED', action, occurrences: total, confidence: MEDIUM,
        summary: `${action} has required approval ${total}× and never been approved`,
        detail: 'Nobody is approving this. Consider removing the authority rather than leaving a request nobody answers.',
        proposal: null
      });
    }
  }
  return findings;
}

// A protected action with no admissible route may be correct — or may be a policy that
// quietly broke and nobody noticed.
function unreachableProtectedActions(graph) {
  if (!graph) return [];
  const findings = [];
  for (const node of graph.nodes.values()) {
    if (node.type !== 'action' || !node.protected) continue;
    const route = resolveRoute(graph, node.id);
    if (route.admissible.length) continue;
    const reasons = [...new Set(route.candidates.flatMap((c) => c.rejections.map((r) => r.code)))];
    findings.push({
      type: 'UNREACHABLE_PROTECTED_ACTION', action: node.id, occurrences: 1,
      confidence: reasons.includes('INSUFFICIENT_AUTHORITY') ? LOW : MEDIUM,
      summary: `${node.id} (${node.severity}) has no admissible route`,
      detail: reasons.length
        ? `Every candidate route fails on: ${reasons.join(', ')}. That may be exactly right — or a policy that broke.`
        : 'No agent in the graph can reach it at all.',
      proposal: null
    });
  }
  return findings;
}

function repeatedDenials(receipts) {
  const denials = new Map();
  for (const receipt of receipts) {
    if (receipt.verifier?.decision === 'EXECUTION_ALLOWED') continue;
    for (const failure of receipt.verifier?.failures ?? []) {
      const key = `${receipt.requested?.action}::${failure.code}`;
      denials.set(key, (denials.get(key) ?? 0) + 1);
    }
  }
  return [...denials].filter(([, n]) => n >= 3).map(([key, occurrences]) => {
    const [action, code] = key.split('::');
    return {
      type: 'REPEATED_DENIAL', action, code, occurrences, confidence: MEDIUM,
      summary: `${action} has been denied ${occurrences}× for ${code}`,
      detail: 'Something keeps asking for what policy keeps refusing. Either the agent should stop trying, or the policy is wrong.',
      proposal: null
    };
  });
}

function countActions(receipts) {
  const counts = new Map();
  for (const receipt of receipts) {
    const action = receipt.requested?.action;
    if (action) counts.set(action, (counts.get(action) ?? 0) + 1);
  }
  return counts;
}

// The subset of findings that can be applied to pctr.json, as a patch a human approves.
export function toManifestProposal(graph, findings) {
  const addActions = [];
  const updateActions = [];
  const updateAgents = [];
  for (const finding of findings) {
    const p = finding.proposal;
    if (!p) continue;
    if (p.addAction) addActions.push(p.addAction);
    if (p.updateAction) updateActions.push(p.updateAction);
    if (p.updateAgent) updateAgents.push(p.updateAgent);
  }
  return { addActions, updateActions, updateAgents, empty: !addActions.length && !updateActions.length && !updateAgents.length };
}

// Applying is explicit and total: the manifest is rewritten from the proposal, and the
// caller decides whether to keep it.
export function applyProposal(manifest, proposal) {
  const next = JSON.parse(JSON.stringify(manifest));
  next.actions = next.actions ?? [];
  const applied = [];

  for (const add of proposal.addActions) {
    const { tool, ...action } = add;
    if (!next.actions.some((a) => a.id === action.id)) { next.actions.push(action); applied.push(`declared ${action.id}`); }
    // Attaching it to the tool that performed it is what puts it in the graph.
    const target = tool ? (next.tools ?? []).find((t) => t.id === tool) : null;
    if (target && !(target.actions ?? []).includes(action.id)) {
      target.actions = [...(target.actions ?? []), action.id];
      applied.push(`attached ${action.id} to tool ${tool}`);
    }
  }
  for (const update of proposal.updateActions) {
    const existing = next.actions.find((a) => a.id === update.id);
    if (existing) { Object.assign(existing, update); applied.push(`updated ${update.id}`); }
    else { next.actions.push(update); applied.push(`declared ${update.id}`); }
  }
  for (const update of proposal.updateAgents) {
    const existing = (next.agents ?? []).find((a) => a.id === update.id);
    if (existing) { Object.assign(existing, update); applied.push(`narrowed authority for ${update.id}`); }
  }
  return { manifest: next, applied };
}

export { severityRank };
