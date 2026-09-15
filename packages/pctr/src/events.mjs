// Canonical PCTR security events. Frameworks emit whatever they emit; adapters
// normalize into these. The set is the shared security meaning, not framework internals.
export const EVENTS = [
  'AGENT_DISCOVERED','AGENT_STARTED','AGENT_DELEGATED','CAPABILITY_DISCOVERED',
  'ACTION_PROPOSED','CONSEQUENCE_DETECTED','TRUST_CHANGED','ROUTE_SELECTED','ROUTE_INVALIDATED',
  'AUTHORITY_REQUESTED','AUTHORITY_ISSUED','EXECUTION_REQUESTED','EXECUTION_ALLOWED',
  'EXECUTION_DENIED','EXECUTION_COMPLETED','RECEIPT_ISSUED'
];
const SET = new Set(EVENTS);
export const isCanonicalEvent = (name) => SET.has(name);
