import { protectedActions, pathsToAction, summarize } from './graph.mjs';
import { replay as replayTimeline, describe } from './timeline.mjs';

// Plain English first. Machine-readable output is opt-in via --json.
const ESC = String.fromCharCode(27);
const useColor = () => process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor() ? `${ESC}[${code}m${s}${ESC}[0m` : String(s));
export const dim = c('2'); export const bold = c('1');
export const red = c('31'); export const green = c('32'); export const yellow = c('33'); export const cyan = c('36');

const SEV_COLOR = { CRITICAL: red, HIGH: yellow, MEDIUM: cyan, LOW: dim };
export const sev = (s) => (SEV_COLOR[s] ?? dim)(s);
export const heading = (text) => `\n${bold(text.toUpperCase())}\n`;
export const field = (label, value, width = 22) => `${label.padEnd(width)}${value}`;
export const chain = (ids) => ids.join(`\n${dim('  |')}\n${dim('  v')}\n`);

export function renderScan(graph) {
  const s = summarize(graph);
  const out = [heading('PCTR'), 'Scanning your agents...', ''];
  out.push(field('Agents found', String(s.agents)));
  out.push(field('Tools found', String(s.tools)));
  out.push(field('External systems', String(s.externalSystems)));
  out.push(field('Potential actions', String(s.actions)));
  out.push('', bold('Protected consequences'), '');
  for (const level of ['CRITICAL', 'HIGH', 'MEDIUM']) out.push(field(sev(level), String(s.bySeverity[level])));
  const top = protectedActions(graph)[0];
  if (top) {
    out.push('', bold('Highest priority:'), '', top.id, '', bold('Route:'), '');
    out.push(chain(pathsToAction(graph, top.id)[0] ?? []));
    out.push('', bold('Problem:'), '',
      `The final action can cause "${top.label}"${top.reversible ? '' : ' irreversibly'} without independent execution authority.`,
      '', bold('Recommended:'), '', `Add TTP authority verification before ${top.id}.`);
  } else {
    out.push('', 'No protected consequences found. Nothing here can cause an irreversible change.');
  }
  return out.join('\n');
}

export function renderPreview(p) {
  // Say where each number came from: a measured value and a value someone typed into
  // pctr.json deserve different confidence.
  const mark = (name) => (p.provenance?.[name] === 'measured' ? green(' (measured)') : p.provenance ? dim(' (declared)') : '');
  const out = [heading('consequence preview')];
  out.push(field('Action', p.action));
  out.push(field('Causes', p.label));
  if (p.recordsAffected != null) out.push(field('Records affected', `${p.recordsAffected}${mark('recordsAffected')}`));
  if (p.financialExposure != null) out.push(field('Financial exposure', `$${p.financialExposure}${mark('amount')}`));
  out.push(field('Reversible', p.reversible ? green('YES') : red('NO')));
  out.push(field('Connected workflows', String(p.connectedWorkflows)));
  out.push(field('Blast radius', `${p.blastRadius.band} (${p.blastRadius.score}/100)`));
  out.push(field('Routes that reach it', String(p.routesThatCanReachIt)));
  out.push(field('Risk', sev(p.severity)));
  if (p.probe && !p.probe.ok) out.push('', yellow(`Probe did not run: ${p.probe.error}`), dim('Falling back to declared values.'));
  out.push('', bold('Recommended'), '', ...p.recommendations.map((r) => `- ${r}`));
  return out.join('\n');
}

export function renderRoute(r) {
  const out = [];
  if (!r.selected) {
    out.push(heading('no admissible route'));
    out.push(`Nothing can reach ${bold(r.action)} under current trust and policy.`, '');
    for (const cand of r.candidates) {
      out.push(dim(cand.routeId));
      for (const rej of cand.rejections) out.push(`  ${red('x')} ${rej.message}`);
      out.push('');
    }
    return out.join('\n');
  }
  out.push(heading('route selected'));
  out.push(chain(r.selected.path));
  out.push('', field('Effective trust', `${r.selected.effectiveTrust} (${r.trustRequired} required for ${sev(r.severity)})`));
  out.push(field('Hops', String(r.selected.hops)));
  if (r.requiresApproval) out.push(field('Human approval', yellow('REQUIRED')));
  const rejected = r.candidates.filter((x) => !x.admissible);
  if (rejected.length) {
    out.push('', bold('Rejected routes'), '');
    for (const cand of rejected) {
      out.push(dim(cand.routeId));
      for (const rej of cand.rejections) out.push(`  ${red('x')} ${rej.message}`);
    }
  }
  return out.join('\n');
}

export function renderGraph(graph) {
  const out = [heading('trust graph')];
  out.push(graph.principal);
  for (const a of [...graph.nodes.values()].filter((n) => n.type === 'agent')) {
    const delegated = graph.edges.filter((e) => e.from === a.id && e.kind === 'delegates').map((e) => e.to);
    const tools = graph.edges.filter((e) => e.from === a.id && e.kind === 'uses').map((e) => e.to);
    out.push(`  |- ${bold(a.id)} ${dim(`[${a.framework}] trust ${a.trust}`)}`);
    for (const d of delegated) out.push(`       ${dim('delegates ->')} ${d}`);
    for (const t of tools) {
      out.push(`       ${dim('uses ->')} ${t}`);
      for (const act of graph.edges.filter((e) => e.from === t && e.kind === 'performs').map((e) => e.to)) {
        const node = graph.nodes.get(act);
        out.push(`            ${node.protected ? red('!') : dim('.')} ${act} ${dim(`-> ${node.label}`)} ${node.protected ? sev(node.severity) : ''}`);
      }
    }
  }
  out.push('', dim('! = protected consequence: must not execute on credential possession alone'));
  return out.join('\n');
}

export function renderTimeline(timeline) {
  const out = [heading('agent time machine'), dim(`run ${timeline.runId}`), ''];
  for (const e of replayTimeline(timeline)) out.push(`${dim(e.at.slice(11, 19))}  ${e.line}`);
  out.push('', dim('Ask why with: pctr explain <event>'));
  return out.join('\n');
}

export function renderWhy(w) {
  if (!w.found) return w.explanation;
  const out = [heading(w.question)];
  out.push(w.answer, '', bold('Because'), '');
  out.push(...w.because.map((b) => `- ${b}`));
  if (w.policy) out.push('', field('Policy', w.policy));
  return out.join('\n');
}

const RESPONSE_COLOR = {
  KEEP: green, REROUTE: cyan, CONSTRAIN: cyan, THROTTLE: yellow,
  STEP_UP: yellow, ESCALATE: yellow, SUSPEND: red, DENY: red, REVOKE: red
};

export function renderDecision(d) {
  const paint = RESPONSE_COLOR[d.response] ?? dim;
  const out = [heading('trust reevaluation')];
  out.push(field('Action', d.action));
  out.push(field('Consequence', sev(d.severity)));
  out.push(field('Response', paint(d.response)));
  out.push(field('Proceeds', d.proceeds ? green('YES') : red('NO')));
  out.push('', d.reason);
  if (d.detail?.constraint) out.push('', `${bold('Proposed bound:')} ${JSON.stringify(d.detail.constraint.max)}`);
  if (d.refusedWeaker) out.push('', yellow(`A weaker response (${d.refusedWeaker}) was proposed and refused.`));
  return out.join('\n');
}

const CONFIDENCE = { HIGH: red, MEDIUM: yellow, LOW: dim };

export function renderLearn(result) {
  const out = [heading('what this run taught pctr')];
  out.push(field('Receipts analysed', String(result.observations.receipts)));
  out.push(field('Runs analysed', String(result.observations.runs)));
  out.push(field('Distinct actions', String(result.observations.actions)));
  if (!result.findings.length) {
    out.push('', 'Nothing new. The map matches what actually happened.');
    return out.join('\n');
  }
  out.push('', bold(`${result.findings.length} finding(s)`), '');
  for (const f of result.findings) {
    const mark = (CONFIDENCE[f.confidence] ?? dim)(f.confidence.padEnd(6));
    out.push(`${mark} ${bold(f.summary)}`);
    out.push(`       ${dim(f.detail)}`);
    if (f.proposal) out.push(`       ${green('can be applied automatically')}`);
    out.push('');
  }
  if (!result.proposal.empty) {
    const n = result.proposal.addActions.length + result.proposal.updateActions.length + result.proposal.updateAgents.length;
    out.push(dim(`${n} change(s) can be written to pctr.json with: pctr learn --apply`));
  }
  return out.join('\n');
}

export function renderReceipt(receipt, verification) {
  const out = [heading('execution receipt')];
  out.push(field('Receipt', receipt.receiptId));
  out.push(field('Requested', `${receipt.requested.action} on ${receipt.requested.target}`));
  out.push(field('Principal', String(receipt.principal)));
  out.push(field('Delegated by', String(receipt.delegator ?? '-')));
  out.push(field('Route', receipt.routeSelected?.routeId ?? '-'));
  out.push(field('Consequence', receipt.consequence ? `${receipt.consequence.class} (${sev(receipt.consequence.severity)})` : '-'));
  out.push(field('Authority bound to', receipt.authorityBound ? JSON.stringify(receipt.authorityBound.materialParams) : '-'));
  out.push(field('Verified by', receipt.verifier.boundary));
  out.push(field('Decision', receipt.verifier.decision === 'EXECUTION_ALLOWED' ? green(receipt.verifier.decision) : red(receipt.verifier.decision)));
  for (const f of receipt.verifier.failures) out.push(`  ${red('x')} ${f.message}`);
  out.push(field('Executed', receipt.executed ? `${receipt.executed.status} at ${receipt.executed.executedAt}` : 'NOT EXECUTED'));
  out.push(field('Policy version', receipt.policyVersion));
  out.push(field('Receipt hash', dim(receipt.receiptHash)));
  if (verification) out.push('', verification.valid ? green('Receipt verifies.') : red(`Receipt INVALID: ${verification.failures.map((f) => f.message).join('; ')}`));
  return out.join('\n');
}

export { describe };
