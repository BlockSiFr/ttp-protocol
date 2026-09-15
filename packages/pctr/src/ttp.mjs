import crypto from 'node:crypto';

// The TTP primitives PCTR depends on, implemented here so that installing PCTR pulls in
// nothing else. These MUST stay bit-for-bit compatible with the Trust Transfer Protocol
// reference implementation in this repo (src/decay.mjs, src/trust_route.mjs,
// src/util.mjs) — tests/conformance.test.mjs compares the two on every run and fails if
// they drift. Change the reference first; mirror it here second.
// Spec: https://github.com/BlockSiFr/ttp-protocol/blob/main/SPECIFICATION.md

export const clamp01 = (n) => Math.max(0, Math.min(1, n));

// Canonical form: sorted keys, fixed numeric precision. Two structurally equal objects
// must hash identically, or a binding could be evaded by reordering fields.
export function canonicalize(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalize).join(',')}]`;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(v[k])}`).join(',')}}`;
  }
  if (typeof v === 'number') return Number(v.toFixed(6)).toString();
  return JSON.stringify(v);
}

export const hashObj = (obj) => `sha256:${crypto.createHash('sha256').update(canonicalize(obj)).digest('hex')}`;

export const failure = (code, message, details = {}) => ({ code, message, details });

// TrustDecay: trust weakens over time without fresh evidence, faster for riskier work,
// and verified activity signals recharge it.
const RISK_MULTIPLIER = { low: 1, medium: 1.2, high: 1.5 };

export function apply_decay({
  initialTrust, decayConstant, elapsedSeconds, activitySignals = [],
  riskTier = 'low', floor = 0, ceiling = 1, calculatedAt
}) {
  const decayedTrust = initialTrust * Math.exp(-(RISK_MULTIPLIER[riskTier] * decayConstant ?? decayConstant) * elapsedSeconds);
  let recharge = 0;
  const appliedSignals = [];
  for (const signal of activitySignals) {
    if (!signal.verified) continue;
    const delta = signal.weight * (signal.recencyFactor ?? 1);
    recharge += delta;
    appliedSignals.push({ ...signal, delta });
  }
  const finalTrust = Math.max(floor, Math.min(ceiling, clamp01(decayedTrust + recharge)));
  return { initialTrust, decayedTrust, finalTrust, elapsedSeconds, decayConstant, riskTier, appliedSignals, calculatedAt };
}

// A trust route is valid only if every hop is identified, trusted by policy, and still
// above the intermediate threshold after per-hop decay.
export function verify_trust_route(input) {
  const failures = [];
  if (!input.hops?.length) failures.push(failure('ROUTE_INVALID', 'empty route'));
  if (input.hops.length > input.maxHops) failures.push(failure('ROUTE_TOO_LONG', 'too many hops'));

  let effectiveTrust = 1;
  for (const hop of input.hops ?? []) {
    if (!hop.subject || !hop.issuer) failures.push(failure('ROUTE_INVALID', 'missing hop identity'));
    effectiveTrust *= Math.max(0, (hop.trustScore ?? 0) - input.decayPerHop);
    if (effectiveTrust < input.minIntermediateTrust) failures.push(failure('ROUTE_INVALID', 'intermediate trust below threshold'));
    if (input.routePolicy?.trustedIssuers && !input.routePolicy.trustedIssuers.includes(hop.issuer)) {
      failures.push(failure('ROUTE_POLICY_VIOLATION', 'untrusted issuer'));
    }
  }
  if (input.routePolicy?.allowedDomains && !input.routePolicy.allowedDomains.includes(`${input.sourceDomain}->${input.targetDomain}`)) {
    failures.push(failure('ROUTE_POLICY_VIOLATION', 'domain crossing not allowed'));
  }
  if (input.routePolicy?.allowedActions && !input.routePolicy.allowedActions.includes(input.action)) {
    failures.push(failure('ROUTE_POLICY_VIOLATION', 'action not allowed'));
  }

  const routeHash = hashObj({ routeId: input.routeId, hops: input.hops, action: input.action, resource: input.resource });
  return {
    valid: failures.length === 0,
    routeId: input.routeId,
    routeHash,
    sourceDomain: input.sourceDomain,
    targetDomain: input.targetDomain,
    delegationDepth: input.hops?.length ?? 0,
    effectiveTrust,
    policyRefs: input.routePolicy?.refs ?? [],
    failureReasons: failures
  };
}
