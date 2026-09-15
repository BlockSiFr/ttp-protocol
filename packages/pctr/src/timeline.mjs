import crypto from 'node:crypto';
import { isCanonicalEvent } from './events.mjs';

// AGENT TIME MACHINE — replay exactly why your AI did what it did.
// Every event records what happened and which earlier events caused it, so "why"
// is answered deterministically from evidence rather than re-narrated by a model.

export function createTimeline({ runId = `run-${crypto.randomUUID().slice(0, 8)}`, objective = null, clock } = {}) {
  const events = [];
  const now = clock ?? (() => new Date().toISOString());
  const api = {
    runId, objective, events,
    record(event, detail = {}, { subject = null, because = [] } = {}) {
      if (!isCanonicalEvent(event)) throw new Error(`Not a canonical PCTR event: ${event}`);
      const entry = { seq: events.length, id: `e${events.length}`, at: now(), event, subject, detail, because };
      events.push(entry);
      return entry;
    },
    last: (event) => [...events].reverse().find((e) => e.event === event) ?? null,
    toJSON: () => ({ runId, objective, events })
  };
  return api;
}

export const fromJSON = (data) => {
  const t = createTimeline({ runId: data.runId, objective: data.objective });
  t.events.push(...(data.events ?? []));
  return t;
};

// REPLAY — the timeline as it happened.
export function replay(timeline) {
  return timeline.events.map((e) => ({ at: e.at, event: e.event, line: describe(e), id: e.id }));
}

// WHY — deterministic explanation built from the recorded causal chain.
export function why(timeline, eventIdOrName) {
  const target = timeline.events.find((e) => e.id === eventIdOrName) ??
    [...timeline.events].reverse().find((e) => e.event === eventIdOrName);
  if (!target) return { found: false, question: eventIdOrName, explanation: `No event matching "${eventIdOrName}" in this run.` };

  const chain = [];
  const visit = (event, depth = 0) => {
    if (depth > 8) return;
    for (const id of event.because ?? []) {
      const cause = timeline.events.find((e) => e.id === id);
      if (cause && !chain.some((c) => c.id === cause.id)) { chain.push(cause); visit(cause, depth + 1); }
    }
  };
  visit(target);
  const reasons = chain.sort((a, b) => a.seq - b.seq).map(describe);
  return {
    found: true,
    question: questionFor(target),
    answer: target.detail.reason ?? answerFor(target),
    because: reasons.length ? reasons : ['This was the first event in the run; nothing preceded it.'],
    policy: target.detail.policy ?? null
  };
}

// FORK + SIMULATE — replay the run with changed inputs, without executing anything.
export function fork(timeline, { upTo = null } = {}) {
  const cut = upTo ? timeline.events.findIndex((e) => e.id === upTo) + 1 : timeline.events.length;
  const forked = createTimeline({ runId: `${timeline.runId}-fork`, objective: timeline.objective });
  forked.events.push(...timeline.events.slice(0, cut).map((e) => ({ ...e })));
  return forked;
}

// COMPARE — what differs between two runs, and where they diverged.
export function compare(a, b) {
  const rows = [];
  const max = Math.max(a.events.length, b.events.length);
  let divergedAt = null;
  for (let i = 0; i < max; i++) {
    const left = a.events[i]; const right = b.events[i];
    const same = describe(left ?? {}) === describe(right ?? {});
    if (!same && divergedAt === null) divergedAt = i;
    rows.push({ seq: i, left: left ? describe(left) : null, right: right ? describe(right) : null, same });
  }
  return { divergedAt, rows, sameOutcome: outcomeOf(a) === outcomeOf(b), outcomes: [outcomeOf(a), outcomeOf(b)] };
}

const outcomeOf = (t) => [...t.events].reverse().find((e) =>
  ['EXECUTION_COMPLETED', 'EXECUTION_ALLOWED', 'EXECUTION_DENIED'].includes(e.event))?.event ?? 'NO_OUTCOME';

const QUESTIONS = {
  EXECUTION_DENIED: 'WHY WAS THIS EXECUTION DENIED?',
  EXECUTION_ALLOWED: 'WHY WAS THIS EXECUTION ALLOWED?',
  EXECUTION_COMPLETED: 'WHY DID THIS ACTION EXECUTE?',
  ROUTE_SELECTED: 'WHY WAS THIS ROUTE SELECTED?',
  ROUTE_INVALIDATED: 'WHY WAS THE ROUTE INVALIDATED?',
  AUTHORITY_ISSUED: 'WHY WAS AUTHORITY ISSUED?',
  CONSEQUENCE_DETECTED: 'WHY IS THIS A PROTECTED CONSEQUENCE?',
  TRUST_CHANGED: 'WHY DID TRUST CHANGE?',
  RECEIPT_ISSUED: 'WHY WAS THIS RECEIPT ISSUED?'
};
const questionFor = (e) => QUESTIONS[e.event] ?? `WHY: ${describe(e).toUpperCase()}?`;

function answerFor(e) {
  const d = e.detail ?? {};
  switch (e.event) {
    case 'EXECUTION_ALLOWED':
      return `Authority ${String(d.bindingHash ?? '').slice(0, 19)}… bound this exact execution, and the effect boundary verified it independently of the agent that requested it.`;
    case 'ROUTE_SELECTED':
      return `${d.routeId} was the most trustworthy admissible route; ${d.rejected ?? 0} candidate route(s) were rejected before optimization.`;
    case 'AUTHORITY_ISSUED':
      return `Authority was issued for this execution and expires at ${d.expiresAt}.`;
    case 'CONSEQUENCE_DETECTED':
      return `This action can cause ${d.consequence}, rated ${d.severity}${d.reversible === false ? ' and irreversible' : ''}.`;
    default: return describe(e);
  }
}

export function describe(e) {
  const d = e.detail ?? {};
  switch (e.event) {
    case 'AGENT_DISCOVERED': return `Agent discovered: ${e.subject}`;
    case 'AGENT_STARTED': return `Objective received${d.objective ? `: ${d.objective}` : ''}`;
    case 'AGENT_DELEGATED': return `${e.subject} delegated to ${d.to}`;
    case 'CAPABILITY_DISCOVERED': return `Capability discovered: ${d.tool ?? e.subject}`;
    case 'ACTION_PROPOSED': return `Action proposed: ${d.action}${d.amount ? ` ($${d.amount})` : ''}`;
    case 'CONSEQUENCE_DETECTED': return `Consequence detected: ${d.consequence} (${d.severity})`;
    case 'TRUST_CHANGED': return `Trust changed: ${e.subject} ${d.from} -> ${d.to}`;
    case 'ROUTE_SELECTED': return `Route selected: ${d.routeId}`;
    case 'ROUTE_INVALIDATED': return `Route invalidated: ${d.routeId}`;
    case 'AUTHORITY_REQUESTED': return `Authority requested for ${d.action}`;
    case 'AUTHORITY_ISSUED': return `TTP authority issued (${String(d.bindingHash ?? '').slice(0, 19)}…)`;
    case 'EXECUTION_REQUESTED': return `Execution requested: ${d.action}`;
    case 'EXECUTION_ALLOWED': return `Effect boundary verified authority`;
    case 'EXECUTION_DENIED': return `Execution denied: ${d.reason ?? (d.failures ?? []).map((f) => f.code).join(', ')}`;
    case 'EXECUTION_COMPLETED': return `${d.action ?? 'Action'} executed`;
    case 'RECEIPT_ISSUED': return `Receipt signed (${d.receiptId})`;
    default: return `${e.event}${e.subject ? ` ${e.subject}` : ''}`;
  }
}
