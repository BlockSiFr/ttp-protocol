import { previewConsequence } from './twin.mjs';
import { resolveRoute } from './router.mjs';
import { respondToChange } from './decisions.mjs';

// What actually happened, made usable by the parts that decide what happens next.
//
// Two rules govern everything here. History may influence which admissible route is
// *preferred*; it may never make an inadmissible route admissible, and it may never
// override a security constraint. Optimization happens after admissibility, not instead
// of it.

export function summarizeHistory(receipts = []) {
  const byRoute = new Map();
  const byAgent = new Map();
  const byAction = new Map();

  for (const receipt of receipts) {
    const allowed = receipt.verifier?.decision === 'EXECUTION_ALLOWED';
    const routeId = receipt.routeSelected?.routeId;
    const action = receipt.requested?.action;

    if (routeId) bump(byRoute, routeId, allowed);
    if (action) bump(byAction, action, allowed);
    for (const agent of receipt.routeSelected?.agents ?? []) bump(byAgent, agent, allowed);
  }
  return {
    byRoute: Object.fromEntries(byRoute), byAgent: Object.fromEntries(byAgent),
    byAction: Object.fromEntries(byAction), total: receipts.length
  };
}

function bump(map, key, allowed) {
  const entry = map.get(key) ?? { attempts: 0, failures: 0 };
  entry.attempts++;
  if (!allowed) entry.failures++;
  map.set(key, entry);
}

// A route that keeps failing is a worse choice than one that doesn't, all else being
// equal. This only ever reorders routes that already passed every admissibility check.
export function failureRate(history, routeId) {
  const entry = history?.byRoute?.[routeId];
  if (!entry || entry.attempts < 2) return 0;   // one failure is not a pattern
  return entry.failures / entry.attempts;
}

export function rankByHistory(admissible, history) {
  return [...admissible].sort((a, b) =>
    b.effectiveTrust - a.effectiveTrust ||
    failureRate(history, a.routeId) - failureRate(history, b.routeId) ||
    a.latencyMs - b.latencyMs || a.costUnits - b.costUnits || a.hops - b.hops);
}

/**
 * Counterfactual replay: what would a different policy have done to executions that
 * already happened? Re-decides each recorded receipt under the proposed policy without
 * executing anything.
 */
export function whatIf(graph, receipts, { policy = {}, limit = 100 } = {}) {
  const proposed = { ...(graph.manifest.policy ?? {}), ...policy };
  const considered = receipts.slice(-limit);
  const changes = [];
  let unchanged = 0;

  for (const receipt of considered) {
    const action = receipt.requested?.action;
    if (!action || !graph.nodes.has(action)) continue;

    const params = receipt.requested?.params ?? {};
    const was = receipt.verifier?.decision ?? 'EXECUTION_DENIED';
    const preview = previewConsequence(graph, action, params);
    const route = resolveRoute(graph, action, { policy: proposed, severity: preview.severity });
    const agents = (route.selected?.agents ?? []).map((id) => graph.nodes.get(id)).filter(Boolean);
    const decision = respondToChange({
      action, preview, currentRoute: route.selected, agents, policy: proposed
    });

    // An execution that was allowed and still needs no extra step stays allowed.
    const wouldBe = decision.proceeds && decision.response !== 'CONSTRAIN'
      ? 'EXECUTION_ALLOWED'
      : decision.response === 'CONSTRAIN' ? 'EXECUTION_ALLOWED_WITH_BOUND' : 'EXECUTION_DENIED';

    if (normalize(wouldBe) === normalize(was)) { unchanged++; continue; }
    changes.push({
      receiptId: receipt.receiptId, action, params,
      was, wouldBe, response: decision.response, reason: decision.reason,
      direction: normalize(was) === 'EXECUTION_ALLOWED' ? 'TIGHTENS' : 'LOOSENS'
    });
  }

  const tightens = changes.filter((c) => c.direction === 'TIGHTENS');
  const loosens = changes.filter((c) => c.direction === 'LOOSENS');
  return {
    considered: considered.length, unchanged,
    changes, tightens: tightens.length, loosens: loosens.length,
    // Loosening policy against real history is the number that deserves a second look.
    verdict: loosens.length
      ? `${loosens.length} execution(s) that were refused would now proceed`
      : tightens.length
        ? `${tightens.length} execution(s) that happened would now be stopped`
        : 'no recorded execution would have been decided differently'
  };
}

const normalize = (decision) => (decision === 'EXECUTION_ALLOWED_WITH_BOUND' ? 'EXECUTION_ALLOWED' : decision);
