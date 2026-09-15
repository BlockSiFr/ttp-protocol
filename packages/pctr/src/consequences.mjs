// Protected consequences come first. An action matters because of the state change
// it can cause, not because of which agent happens to hold the credential.

export const CONSEQUENCE_CLASSES = {
  MONEY_MOVED:        { label: 'money moved',            severity: 'HIGH',     reversible: false },
  DATA_DELETED:       { label: 'data deleted',           severity: 'CRITICAL', reversible: false },
  IDENTITY_CHANGED:   { label: 'identity disabled or changed', severity: 'HIGH', reversible: true },
  SECRET_EXPOSED:     { label: 'secret exposed',         severity: 'CRITICAL', reversible: false },
  PRODUCTION_CHANGED: { label: 'production changed',     severity: 'HIGH',     reversible: true },
  INFRA_MODIFIED:     { label: 'infrastructure modified', severity: 'HIGH',    reversible: true },
  ACCESS_GRANTED:     { label: 'access granted',         severity: 'HIGH',     reversible: true },
  MESSAGE_SENT:       { label: 'external message sent',  severity: 'MEDIUM',   reversible: false },
  CONTRACT_EXECUTED:  { label: 'contract executed',      severity: 'CRITICAL', reversible: false },
  PHYSICAL_CHANGED:   { label: 'physical system changed', severity: 'CRITICAL', reversible: false },
  DATA_WRITTEN:       { label: 'data written',           severity: 'MEDIUM',   reversible: true },
  DATA_READ:          { label: 'data read',              severity: 'LOW',      reversible: true },
  NONE:               { label: 'no protected consequence', severity: 'LOW',    reversible: true }
};

// The verb decides, not the namespace: payments.status reads, payments.transfer moves
// money. A read verb in the final segment settles the question before anything else.
const READ_VERB = /(?:^|[.\/_:-])(get|list|read|status|search|query|fetch|describe|show|view|count|preview)$/i;

// Ordered: first match wins, so the destructive readings are checked before the mild ones.
const RULES = [
  [/(payment|transfer|payout|refund|charge|wire|treasury|stripe|ledger\.move|\bpay\b)/i, 'MONEY_MOVED'],
  [/(delete|destroy|drop|purge|truncate|wipe|erase|remove_all|terminate)/i, 'DATA_DELETED'],
  [/(secret|credential|token|apikey|api_key|private_key|vault\.read|password)/i, 'SECRET_EXPOSED'],
  [/(contract|sign|execute_agreement|onchain|smart_contract)/i, 'CONTRACT_EXECUTED'],
  [/(device|actuator|valve|door|robot|plc|scada)/i, 'PHYSICAL_CHANGED'],
  [/(disable_user|deactivate|suspend_user|user\.update|identity|scim|role\.assign)/i, 'IDENTITY_CHANGED'],
  [/(grant|permission|policy\.attach|share|acl|invite)/i, 'ACCESS_GRANTED'],
  [/(deploy|release|rollback|migrate|prod|k8s\.apply|helm)/i, 'PRODUCTION_CHANGED'],
  [/(terraform|infra|instance|bucket|dns|firewall|network|cluster)/i, 'INFRA_MODIFIED'],
  [/(send|email|slack|sms|post_message|notify|publish|tweet)/i, 'MESSAGE_SENT'],
  [/(write|create|update|insert|upsert|patch|put)/i, 'DATA_WRITTEN'],
  [/(read|get|list|search|query|select|fetch)/i, 'DATA_READ']
];

export function classifyAction(actionId, hints = {}) {
  if (hints.consequence && CONSEQUENCE_CLASSES[hints.consequence]) {
    return decorate(actionId, hints.consequence, hints);
  }
  if (READ_VERB.test(actionId)) return decorate(actionId, 'DATA_READ', hints);
  for (const [pattern, cls] of RULES) {
    if (pattern.test(actionId)) return decorate(actionId, cls, hints);
  }
  return decorate(actionId, 'NONE', hints);
}

const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
export const severityRank = (s) => RANK[s] ?? 0;
export const maxSeverity = (a, b) => (severityRank(a) >= severityRank(b) ? a : b);

function decorate(actionId, cls, hints) {
  const base = CONSEQUENCE_CLASSES[cls];
  let severity = hints.severity ?? base.severity;
  const reversible = hints.reversible ?? base.reversible;
  // Scale and money both raise the stakes beyond the action name itself.
  if (hints.recordsAffected >= 1000 || hints.amount >= 5000) severity = maxSeverity(severity, 'CRITICAL');
  else if (hints.recordsAffected >= 100 || hints.amount >= 500) severity = maxSeverity(severity, 'HIGH');
  return {
    action: actionId,
    consequence: cls,
    label: base.label,
    severity,
    reversible,
    protected: cls !== 'NONE' && severityRank(severity) >= RANK.MEDIUM
  };
}

// A protected action is one whose consequence must not occur on credential possession alone.
export const isProtected = (actionId, hints) => classifyAction(actionId, hints).protected;
