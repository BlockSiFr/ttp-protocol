"""PCTR <-> Microsoft AGT bridge for Python.

AGT (https://github.com/microsoft/agent-governance-toolkit) is Python-first, so this
mirrors ``packages/pctr/src/agt.mjs`` for integrations that live on that side.

Types follow the toolkit's own definitions in
``agent-governance-typescript/src/types.ts`` — PolicyAction, PolicyDecisionResult,
AuditEntry, TrustScore, TrustTier, ExecutionRing, CascadeEvent, RingViolation.

The loop (docs/integration-guide.md Part 6):

1. AGT enforces pre-execution policy
2. PCTR observes the consequence, the route and the signed receipt
3. Trust is recomputed from that evidence
4. AGT consumes it and adjusts the next decision

AGT decides allow/deny. PCTR reports evidence and never a competing verdict.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Optional

__all__ = [
    "AGT_TIER_THRESHOLDS", "RING_BY_SEVERITY", "TrustScore", "trust_tier",
    "to_agt_trust_score", "from_agt_trust_score", "to_agt_score", "from_agt_score",
    "ring_for_severity", "is_spiffe_id", "parse_spiffe_id", "classify_action",
    "domain_for", "agt_claims", "to_trust_evidence", "to_mesh_attestation",
    "normalize_agt_event",
]

# ── Trust ────────────────────────────────────────────────────────────────────
# AGT's TrustScore is 0-1, banded into tiers. Thresholds are the toolkit's own
# defaults (agent-governance-typescript/src/trust.ts). A TTP score is already 0-1,
# so it maps across unscaled — that is the point of sharing a scale.
AGT_TIER_THRESHOLDS: Dict[str, float] = {
    "untrusted": 0.0, "provisional": 0.3, "trusted": 0.6, "verified": 0.85,
}


def _clamp01(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def trust_tier(score: Any, thresholds: Optional[Mapping[str, float]] = None) -> str:
    """Return AGT's TrustTier for a 0-1 score."""
    t = dict(AGT_TIER_THRESHOLDS if thresholds is None else thresholds)
    value = _clamp01(score)
    if value >= t["verified"]:
        return "Verified"
    if value >= t["trusted"]:
        return "Trusted"
    if value >= t["provisional"]:
        return "Provisional"
    return "Untrusted"


@dataclass
class TrustScore:
    """AGT's TrustScore: ``{ overall, dimensions, tier }``."""

    overall: float
    dimensions: Dict[str, float] = field(default_factory=dict)
    tier: str = ""

    def __post_init__(self) -> None:
        self.overall = _clamp01(self.overall)
        if not self.tier:
            self.tier = trust_tier(self.overall)

    def as_dict(self) -> Dict[str, Any]:
        return {"overall": self.overall, "dimensions": self.dimensions, "tier": self.tier}


def to_agt_trust_score(ttp_score: Any, dimensions: Optional[Mapping[str, float]] = None,
                       thresholds: Optional[Mapping[str, float]] = None) -> TrustScore:
    overall = _clamp01(ttp_score)
    return TrustScore(overall=overall, dimensions=dict(dimensions or {}),
                      tier=trust_tier(overall, thresholds))


def from_agt_trust_score(trust_score: Any) -> float:
    """Accept a TrustScore, a mapping, or a bare number."""
    if isinstance(trust_score, TrustScore):
        return trust_score.overall
    if isinstance(trust_score, Mapping):
        return _clamp01(trust_score.get("overall", 0))
    return _clamp01(trust_score)


# The 0-1000 integer scale from integration-guide.md 6.4. Upstream AGT does NOT use it;
# this is only for downstream components that explicitly expect that scale.
def to_agt_score(ttp_score: Any) -> int:
    return round(_clamp01(ttp_score) * 1000)


def from_agt_score(agt_score: Any) -> float:
    try:
        return _clamp01(float(agt_score) / 1000)
    except (TypeError, ValueError):
        return 0.0


# AGT's ExecutionRing: Ring0 is the most privileged. PCTR proposes a ring from what the
# action can cause; AGT's own actionRings configuration stays authoritative.
RING_BY_SEVERITY: Dict[str, int] = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def ring_for_severity(severity: Optional[str]) -> int:
    return RING_BY_SEVERITY.get(severity or "", 3)


# ── SPIFFE ───────────────────────────────────────────────────────────────────
_SPIFFE = re.compile(r"^spiffe://([^/]+)(/.*)?$")


def is_spiffe_id(agent_id: Any) -> bool:
    return bool(_SPIFFE.match(str(agent_id or "")))


def parse_spiffe_id(agent_id: Any) -> Optional[Dict[str, str]]:
    match = _SPIFFE.match(str(agent_id or ""))
    if not match:
        return None
    return {"trust_domain": match.group(1), "path": match.group(2) or "", "id": str(agent_id)}


# ── Consequences ─────────────────────────────────────────────────────────────
# Mirrors packages/pctr/src/consequences.mjs. The verb decides over the namespace:
# payments.status reads, payments.transfer moves money.
_READ_VERB = re.compile(
    r"(?:^|[./_:-])(get|list|read|status|search|query|fetch|describe|show|view|count|preview)$",
    re.IGNORECASE)

_RULES = [
    (re.compile(r"payment|transfer|payout|refund|charge|wire|treasury|stripe|ledger\.move|\bpay\b", re.I), "MONEY_MOVED"),
    (re.compile(r"delete|destroy|drop|purge|truncate|wipe|erase|remove_all|terminate", re.I), "DATA_DELETED"),
    (re.compile(r"secret|credential|token|apikey|api_key|private_key|vault\.read|password", re.I), "SECRET_EXPOSED"),
    (re.compile(r"contract|sign|execute_agreement|onchain|smart_contract", re.I), "CONTRACT_EXECUTED"),
    (re.compile(r"device|actuator|valve|door|robot|plc|scada", re.I), "PHYSICAL_CHANGED"),
    (re.compile(r"disable_user|deactivate|suspend_user|user\.update|identity|scim|role\.assign", re.I), "IDENTITY_CHANGED"),
    (re.compile(r"grant|permission|policy\.attach|share|acl|invite", re.I), "ACCESS_GRANTED"),
    (re.compile(r"deploy|release|rollback|migrate|prod|k8s\.apply|helm", re.I), "PRODUCTION_CHANGED"),
    (re.compile(r"terraform|infra|instance|bucket|dns|firewall|network|cluster", re.I), "INFRA_MODIFIED"),
    (re.compile(r"send|email|slack|sms|post_message|notify|publish|tweet", re.I), "MESSAGE_SENT"),
    (re.compile(r"write|create|update|insert|upsert|patch|put", re.I), "DATA_WRITTEN"),
    (re.compile(r"read|get|list|search|query|select|fetch", re.I), "DATA_READ"),
]

_CONSEQUENCES = {
    "MONEY_MOVED": ("money moved", "HIGH", False),
    "DATA_DELETED": ("data deleted", "CRITICAL", False),
    "IDENTITY_CHANGED": ("identity disabled or changed", "HIGH", True),
    "SECRET_EXPOSED": ("secret exposed", "CRITICAL", False),
    "PRODUCTION_CHANGED": ("production changed", "HIGH", True),
    "INFRA_MODIFIED": ("infrastructure modified", "HIGH", True),
    "ACCESS_GRANTED": ("access granted", "HIGH", True),
    "MESSAGE_SENT": ("external message sent", "MEDIUM", False),
    "CONTRACT_EXECUTED": ("contract executed", "CRITICAL", False),
    "PHYSICAL_CHANGED": ("physical system changed", "CRITICAL", False),
    "DATA_WRITTEN": ("data written", "MEDIUM", True),
    "DATA_READ": ("data read", "LOW", True),
    "NONE": ("no protected consequence", "LOW", True),
}

_SEVERITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def severity_rank(severity: Optional[str]) -> int:
    return _SEVERITY_RANK.get(severity or "", 0)


def classify_action(action: str, params: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    """What can this action cause? Scale and money raise the stakes."""
    hints = dict(params or {})
    consequence = hints.get("consequence")
    if consequence not in _CONSEQUENCES:
        consequence = None
    if consequence is None:
        consequence = "DATA_READ" if _READ_VERB.search(action or "") else None
    if consequence is None:
        for pattern, name in _RULES:
            if pattern.search(action or ""):
                consequence = name
                break
    consequence = consequence or "NONE"

    label, severity, reversible = _CONSEQUENCES[consequence]
    severity = hints.get("severity", severity)
    reversible = hints.get("reversible", reversible)

    records = hints.get("recordsAffected", hints.get("records_affected", 0)) or 0
    amount = hints.get("amount", 0) or 0
    if records >= 1000 or amount >= 5000:
        severity = severity if severity_rank(severity) >= 3 else "CRITICAL"
    elif records >= 100 or amount >= 500:
        severity = severity if severity_rank(severity) >= 2 else "HIGH"

    return {
        "action": action, "consequence": consequence, "label": label,
        "severity": severity, "reversible": reversible,
        "protected": consequence != "NONE" and severity_rank(severity) >= 1,
        "required_ring": ring_for_severity(severity),
    }


_DOMAIN_BY_CONSEQUENCE = {
    "MONEY_MOVED": "payments", "DATA_DELETED": "data-destruction", "SECRET_EXPOSED": "secrets",
    "PRODUCTION_CHANGED": "prod-change", "INFRA_MODIFIED": "infrastructure",
    "IDENTITY_CHANGED": "identity", "ACCESS_GRANTED": "access", "MESSAGE_SENT": "communications",
    "CONTRACT_EXECUTED": "contracts", "PHYSICAL_CHANGED": "physical",
    "DATA_WRITTEN": "data-write", "DATA_READ": "data-read",
}


def domain_for(consequence: Optional[str]) -> str:
    return _DOMAIN_BY_CONSEQUENCE.get(consequence or "", "general")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# ── OPA/Rego bridge (integration-guide.md 6.2) ───────────────────────────────
def agt_claims(*, ttp_score: float, action: Optional[str] = None,
               consequence: Optional[str] = None, severity: Optional[str] = None,
               reversible: Optional[bool] = None, domain: Optional[str] = None,
               issuer_count: int = 0, agents: Optional[List[str]] = None,
               route_id: Optional[str] = None, receipt: Optional[Mapping[str, Any]] = None,
               at: Optional[str] = None) -> Dict[str, Any]:
    """Build ``input.ttp`` for AGT's policy engine. Rego stays authoritative."""
    if action and not consequence:
        classified = classify_action(action)
        consequence = classified["consequence"]
        severity = severity or classified["severity"]
        reversible = classified["reversible"] if reversible is None else reversible

    agents = list(agents or [])
    score = _clamp01(ttp_score)
    return {
        "ttp": {
            "ttp_domain": domain or domain_for(consequence),
            "ttp_score": round(score, 4),
            "issuer_count": issuer_count,
            "ttp_agt_score": to_agt_score(score),            # legacy 0-1000 consumers
            "trust_score": to_agt_trust_score(score).as_dict(),  # AGT-native TrustScore
            "trust_tier": trust_tier(score),
            "required_ring": ring_for_severity(severity),
            "consequence": consequence,
            "severity": severity,
            "reversible": reversible,
            "route_id": route_id,
            "agents": agents,
            "spiffe_ids": [a for a in agents if is_spiffe_id(a)],
            "receipt_id": (receipt or {}).get("receiptId"),
            "receipt_hash": (receipt or {}).get("receiptHash"),
            "evaluated_at": at or _now(),
        }
    }


# ── Evidence back to AGT (step 2 of the loop) ────────────────────────────────
def to_trust_evidence(receipt: Optional[Mapping[str, Any]],
                      domain: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if not receipt:
        return None
    verifier = receipt.get("verifier") or {}
    consequence = receipt.get("consequence") or {}
    allowed = verifier.get("decision") == "EXECUTION_ALLOWED"
    severity = consequence.get("severity", "LOW")
    executed = receipt.get("executed") or {}
    return {
        "type": "TTPBehavioralEvidence",
        "version": 1,
        "subject": receipt.get("requestedBy") or receipt.get("principal"),
        "domain": domain or domain_for(consequence.get("class")),
        "action": (receipt.get("requested") or {}).get("action"),
        "outcome": "allowed" if allowed else "denied",
        # A denial at a high-consequence action is the strongest behavioural signal.
        "weight": round((severity_rank(severity) + 1) / 4, 2),
        "failures": [f.get("code") for f in verifier.get("failures", [])],
        "receipt_id": receipt.get("receiptId"),
        "receipt_hash": receipt.get("receiptHash"),
        "observed_at": executed.get("executedAt") or receipt.get("issuedAt"),
    }


def to_mesh_attestation(receipt: Optional[Mapping[str, Any]], peer: Optional[str] = None,
                        trust_domain: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """AgentMesh peer trust attestation (integration-guide.md 6.5)."""
    if not receipt:
        return None
    route = receipt.get("routeSelected") or {}
    principal = receipt.get("principal")
    parsed = parse_spiffe_id(principal) if principal else None
    score = _clamp01(route.get("effectiveTrust", 0))
    return {
        "type": "AgentMeshTrustAttestation",
        "version": 1,
        "subject": receipt.get("requestedBy") or principal,
        "peer": peer,
        "trust_domain": trust_domain or (parsed or {}).get("trust_domain"),
        "action": (receipt.get("requested") or {}).get("action"),
        "consequence": (receipt.get("consequence") or {}).get("class"),
        "outcome": (receipt.get("verifier") or {}).get("decision", "EXECUTION_DENIED"),
        "trust_score": to_agt_trust_score(score).as_dict(),
        "agt_trust_score": to_agt_score(score),
        "ttp_score": score,
        "evidence": {
            "receipt_id": receipt.get("receiptId"),
            "receipt_hash": receipt.get("receiptHash"),
            "signed_by": receipt.get("keyId"),
        },
        "issued_at": receipt.get("issuedAt"),
    }


# ── AGT events -> canonical PCTR events ──────────────────────────────────────
_POLICY_ACTION = {
    "allow": "EXECUTION_ALLOWED", "log": "EXECUTION_ALLOWED", "warn": "EXECUTION_ALLOWED",
    "deny": "EXECUTION_DENIED",
    "require_approval": "EXECUTION_DENIED",  # not denied forever, but not executable yet
}
_LEGACY_DECISION = {
    "allow": "EXECUTION_ALLOWED", "deny": "EXECUTION_DENIED", "review": "EXECUTION_DENIED",
}
# CascadeEvent actions all describe trust collapsing around an agent.
_CASCADE_TRUST = {
    "circuit_opened": 0.2, "agent_degraded": 0.3, "agent_quarantined": 0.0,
    "agent_killed": 0.0, "rollback_triggered": 0.4, "health_propagated": None,
}


def normalize_agt_event(event: Any) -> Optional[Dict[str, Any]]:
    """Map one AGT event onto a canonical PCTR event, or None if unrecognised.

    Returning None is a valid, common answer: PCTR never invents a security event
    from a shape it cannot read.
    """
    if not isinstance(event, Mapping):
        return None

    agent = (event.get("agentId") or event.get("agent_id") or event.get("sourceAgentId")
             or event.get("agent") or event.get("subject"))
    action = (event.get("action") or event.get("operation") or event.get("tool")
              or event.get("capability"))

    # CascadeEvent
    if event.get("eventId") and isinstance(event.get("affectedAgentIds"), list) and action in _CASCADE_TRUST:
        to = _CASCADE_TRUST[action]
        if to is None:
            return None  # health_propagated is telemetry, not a trust change
        return {"event": "TRUST_CHANGED", "subject": agent, "detail": {
            "to": to, "reason": event.get("reason") or f"AGT cascade containment: {action}",
            "cascade_action": action, "affected": event.get("affectedAgentIds"),
            "blast_radius": event.get("blastRadius")}}

    # RingViolation
    if event.get("requiredRing") is not None and event.get("agentRing") is not None:
        return {"event": "EXECUTION_DENIED", "subject": agent, "detail": {
            "action": event.get("action"),
            "reason": event.get("message") or
                      f"agent is Ring{event['agentRing']}; {event.get('action')} requires Ring{event['requiredRing']}",
            "agent_ring": event.get("agentRing"), "required_ring": event.get("requiredRing")}}

    # KillSwitchResult
    if event.get("killed") is True or event.get("terminated") is True:
        return {"event": "TRUST_CHANGED", "subject": agent, "detail": {
            "to": 0.0, "reason": event.get("reason") or "AGT kill switch engaged"}}

    # PolicyDecisionResult
    if isinstance(event.get("allowed"), bool) and event.get("action") in _POLICY_ACTION:
        policy_action = event["action"]
        pending = policy_action == "require_approval"
        approvers = event.get("approvers") or []
        return {
            "event": "EXECUTION_ALLOWED" if (event["allowed"] and not pending) else _POLICY_ACTION[policy_action],
            "subject": agent,
            "detail": {
                "action": event.get("operation") or event.get("tool"),
                "reason": event.get("reason") or (
                    f"AGT requires approval from: {', '.join(approvers) or 'an approver'}" if pending
                    else f"AGT policy {policy_action}"),
                "policy": event.get("policyName") or event.get("matchedRule"),
                "policy_action": policy_action,
                "approvers": approvers,
                "rate_limited": event.get("rateLimited", False),
            },
        }

    # AuditEntry — AGT hash-chains its audit log as PCTR chains receipts.
    if event.get("hash") and "previousHash" in event and isinstance(event.get("decision"), str):
        mapped = _LEGACY_DECISION.get(event["decision"])
        if not mapped:
            return None
        return {"event": mapped, "subject": agent, "detail": {
            "action": event.get("action"), "decision": event["decision"],
            "reason": f'AGT audit entry records decision "{event["decision"]}"',
            "audit_hash": event.get("hash"), "previous_hash": event.get("previousHash"),
            "skill": (event.get("skillAuditMetadata") or {}).get("skillName")}}

    # TrustVerificationResult
    if isinstance(event.get("verified"), bool) and event.get("trustScore") is not None:
        score = from_agt_trust_score(event["trustScore"])
        tier = event["trustScore"].get("tier") if isinstance(event["trustScore"], Mapping) else None
        return {"event": "TRUST_CHANGED", "subject": agent, "detail": {
            "to": score, "tier": tier or trust_tier(score),
            "reason": event.get("reason") or
                      f"AGT trust verification {'passed' if event['verified'] else 'failed'}"}}

    kind = str(event.get("type") or event.get("event") or event.get("eventType") or event.get("kind") or "").lower()

    if re.search(r"register|discover|onboard", kind) and agent:
        raw = event.get("trustScore")
        return {"event": "AGENT_DISCOVERED", "subject": agent, "detail": {
            "framework": "microsoft-agt",
            "trust": from_agt_trust_score(raw) if raw is not None else None,
            "status": event.get("status")}}

    if re.search(r"delegat|handoff|assign", kind):
        to = event.get("to") or event.get("target") or event.get("targetAgent") or event.get("delegateTo")
        return {"event": "AGENT_DELEGATED", "subject": agent, "detail": {"to": to}} if to else None

    if re.search(r"(action|tool|capability).*(request|invoke|propos|call)|invocation", kind):
        if not action:
            return None
        params = event.get("parameters") or event.get("params") or event.get("arguments") or event.get("input") or {}
        classified = classify_action(action, params)
        detail: Dict[str, Any] = {"action": action}
        detail.update(params if isinstance(params, Mapping) else {})
        detail.update({"consequence": classified["consequence"], "severity": classified["severity"],
                       "required_ring": classified["required_ring"]})
        return {"event": "ACTION_PROPOSED", "subject": agent, "detail": detail}

    if re.search(r"complete|finish|result", kind) and action:
        failed = bool(event.get("error") or event.get("failed"))
        return {"event": "EXECUTION_COMPLETED", "subject": agent,
                "detail": {"action": action, "status": "FAILED" if failed else "SUCCEEDED"}}

    return None
