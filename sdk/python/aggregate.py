"""TTP trust score aggregation — the normative algorithm.

Implements protocol/aggregation-spec.md v1.1 step for step, mirroring
packages/pctr/src/aggregate.mjs. The same eleven test vectors run against both
bindings (scripts/check-agt-parity.mjs), so they cannot drift apart.

Two properties, both deliberate:
  - Negative signals weigh more (default 1.5x), so an agent behaving well most of the
    time cannot average away a few dangerous actions.
  - No single issuer may contribute more than effective_cap of the score, and the excess
    goes to the *uncapped* issuers. v1.0 re-normalized across everyone, which handed the
    excess straight back whenever the other issuers were light.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Mapping, Optional

__all__ = ["DEFAULT_PARAMS", "INSUFFICIENT_TRUST_DATA", "aggregate_trust", "score_label"]

DEFAULT_PARAMS: Dict[str, float] = {
    "receipt_window_s": 300,
    "max_issuer_weight": 0.40,
    "negative_weight_multiplier": 1.5,
    "decay_half_life_s": 120,
}

INSUFFICIENT_TRUST_DATA = "INSUFFICIENT_TRUST_DATA"


def aggregate_trust(receipts: Optional[List[Mapping[str, Any]]] = None,
                    current_time_ms: Optional[int] = None,
                    params: Optional[Mapping[str, float]] = None) -> Dict[str, Any]:
    """Aggregate behavioural receipts into a trust score in [0.0, 1.0]."""
    p = {**DEFAULT_PARAMS, **(params or {})}
    receipts = list(receipts or [])

    # Step 1 — filter to the receipt window.
    window = [r for r in receipts
              if current_time_ms - r["timestamp"] <= p["receipt_window_s"] * 1000]
    if not window:
        return {"error": INSUFFICIENT_TRUST_DATA, "score": None,
                "contributing_receipts": 0, "contributing_issuers": 0}

    # Steps 2 and 3 — time decay, then negative signal amplification.
    weighted = []
    for r in window:
        age_s = (current_time_ms - r["timestamp"]) / 1000
        decay = math.exp(-math.log(2) * age_s / p["decay_half_life_s"])
        negative = r["score"] < 0.5
        weighted.append({**r, "age_s": age_s,
                         "signal_weight": decay * p["negative_weight_multiplier"] if negative else decay})

    # Step 4 — per-issuer weighted score.
    by_issuer: Dict[str, Dict[str, float]] = {}
    for r in weighted:
        e = by_issuer.setdefault(r["issuer_id"], {"weighted_sum": 0.0, "total_weight": 0.0})
        e["weighted_sum"] += r["score"] * r["signal_weight"]
        e["total_weight"] += r["signal_weight"]

    issuers = [{"issuer_id": k, "issuer_score": e["weighted_sum"] / e["total_weight"],
                "issuer_raw_weight": e["total_weight"]}
               for k, e in by_issuer.items()]

    # Step 5 — cap, then water-fill the excess onto the uncapped issuers. A cap below
    # 1/n is infeasible, so that is the floor on the cap actually applied.
    total_raw = sum(i["issuer_raw_weight"] for i in issuers)
    effective_cap = max(p["max_issuer_weight"], 1 / len(issuers))
    for i in issuers:
        i["weight"] = i["issuer_raw_weight"] / total_raw
        i["capped"] = False

    for _ in range(len(issuers) + 1):
        over = [i for i in issuers if not i["capped"] and i["weight"] > effective_cap + 1e-12]
        if not over:
            break
        excess = 0.0
        for i in over:
            excess += i["weight"] - effective_cap
            i["weight"] = effective_cap
            i["capped"] = True
        free = [i for i in issuers if not i["capped"]]
        free_total = sum(i["weight"] for i in free)
        if not free or free_total == 0:
            break
        for i in free:
            i["weight"] += excess * (i["weight"] / free_total)

    # Step 6 — combine, and clamp for floating point.
    raw_score = sum(i["issuer_score"] * i["weight"] for i in issuers)

    return {
        "score": max(0.0, min(1.0, raw_score)),
        "contributing_receipts": len(window),
        "contributing_issuers": len(issuers),
        "oldest_receipt_age_s": round(max(r["age_s"] for r in weighted)),
        "issuers": [{"issuer_id": i["issuer_id"],
                     "issuer_score": round(i["issuer_score"], 6),
                     "weight": round(i["weight"], 6),
                     "capped": i["capped"]} for i in issuers],
    }


# The scale from protocol/scoring-semantics.md, so a score can be read in words.
def score_label(score: Optional[float]) -> str:
    if score is None:
        return "Unknown"
    if score >= 0.90:
        return "Excellent"
    if score >= 0.70:
        return "Good"
    if score >= 0.50:
        return "Marginal"
    if score >= 0.30:
        return "Poor"
    if score >= 0.10:
        return "Bad"
    return "Critical"
