import { protectedActions, pathsToAction, summarize } from './graph.mjs';
import { previewConsequence } from './twin.mjs';
import { resolveRoute } from './router.mjs';

// A scan result nobody can share is a scan result nobody acts on. This renders the
// findings as Markdown that drops straight into a PR, an issue, or a message.

const EMOJI = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '⚪' };
const HOMEPAGE = 'https://github.com/BlockSiFr/ttp-protocol/tree/main/packages/pctr';

export function badgeUrl(graph) {
  const { bySeverity } = summarize(graph);
  const critical = bySeverity.CRITICAL;
  const label = critical
    ? `${critical}%20critical%20consequence${critical === 1 ? '' : 's'}`
    : `${summarize(graph).protected}%20protected%20consequences`;
  const color = critical ? 'critical' : summarize(graph).protected ? 'orange' : 'brightgreen';
  return `https://img.shields.io/badge/PCTR-${label}-${color}?style=flat-square&labelColor=0A0A0F`;
}

export function renderReport(graph, { title = 'PCTR consequence scan', includeBadge = true } = {}) {
  const summary = summarize(graph);
  const findings = protectedActions(graph);
  const irreversible = findings.filter((f) => !f.reversible);
  const out = [];

  out.push(`## ${summary.bySeverity.CRITICAL ? '🛑' : '🔍'} ${title}`, '');
  if (includeBadge) out.push(`![PCTR](${badgeUrl(graph)})`, '');
  if (!summary.agents) {
    out.push(`PCTR found no agents to scan here. Declare them in \`pctr.json\` — see the [manifest format](${HOMEPAGE}#pctrjson).`, '');
    return `${out.join('\n')}\n${footer()}`;
  }
  out.push(`**${summary.agents} agents · ${summary.tools} tools · ${summary.actions} actions.** ${
    findings.length
      ? `${findings.length} of them can cause a protected consequence${irreversible.length ? `, and ${irreversible.length} cannot be undone` : ''}.`
      : 'None of them can cause a protected consequence.'
  }`, '');
  if (!findings.length) {
    out.push('Nothing in this graph can move money, delete data, change production or expose a secret.', '');
    return `${out.join('\n')}\n${footer()}`;
  }

  out.push('| Severity | Consequences |', '| --- | --- |');
  for (const level of ['CRITICAL', 'HIGH', 'MEDIUM']) {
    if (summary.bySeverity[level]) out.push(`| ${EMOJI[level]} ${level} | ${summary.bySeverity[level]} |`);
  }
  out.push('');

  const top = findings[0];
  const preview = previewConsequence(graph, top.id);
  const route = pathsToAction(graph, top.id)[0] ?? [];
  const resolved = resolveRoute(graph, top.id);

  out.push(`### Highest priority: \`${top.id}\``, '');
  out.push([
    `Causes **${preview.label}**`,
    preview.reversible ? 'reversible' : '**irreversible**',
    preview.recordsAffected != null ? `${preview.recordsAffected.toLocaleString('en-US')} records` : null,
    preview.financialExposure != null ? `$${preview.financialExposure.toLocaleString('en-US')}` : null,
    `blast radius ${preview.blastRadius.band}`
  ].filter(Boolean).join(' · '), '');

  if (route.length) out.push('```', route.join('\n  ↓\n'), '```', '');

  if (resolved.selected) {
    out.push(`Today this executes over \`${resolved.selected.agents.join(' → ')}\` at effective trust **${resolved.selected.effectiveTrust}**${
      resolved.requiresApproval ? ', and policy requires human approval' : ' with no human in the loop'}.`, '');
  } else {
    out.push('No admissible route can reach it under current trust and policy.', '');
  }

  out.push('**What to do:** ' + (preview.recommendations[0] ?? 'Add TTP authority verification before this action.'), '');

  if (findings.length > 1) {
    out.push('<details>', '<summary>All protected consequences</summary>', '');
    out.push('| Action | Causes | Severity | Reversible | Routes that reach it |', '| --- | --- | --- | --- | --- |');
    for (const finding of findings) {
      const p = previewConsequence(graph, finding.id);
      out.push(`| \`${finding.id}\` | ${p.label} | ${EMOJI[p.severity]} ${p.severity} | ${p.reversible ? 'yes' : 'no'} | ${p.routesThatCanReachIt} |`);
    }
    out.push('', '</details>', '');
  }

  return `${out.join('\n')}\n${footer()}`;
}

const footer = () =>
  `---\n<sub>Scanned with [PCTR](${HOMEPAGE}) — \`npx @blocksifr/pctr scan\`. Nothing left this machine.</sub>\n`;
