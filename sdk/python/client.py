from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from urllib import request as urllib_request
import json


class Decision(str, Enum):
    PERMIT = "PERMIT"
    DENY = "DENY"
    STEP_UP = "STEP_UP"
    ESCALATE = "ESCALATE"


class DecisionMode(str, Enum):
    FULL = "FULL"
    CONSTRAINED = "CONSTRAINED"
    REQUIRES_REATTESTATION = "REQUIRES_REATTESTATION"
    REQUIRES_HUMAN_APPROVAL = "REQUIRES_HUMAN_APPROVAL"
    FAILED_CLOSED = "FAILED_CLOSED"


@dataclass
class Principal:
    id: str
    type: str


@dataclass
class Resource:
    type: str
    id: str


@dataclass
class AuthorityGrant:
    grantId: str
    expiresAt: str
    scope: List[str] = field(default_factory=list)


@dataclass
class AuthorizeRequest:
    base_url: str
    requestId: str
    principal: Principal
    action: str
    resource: Resource
    context: Dict[str, Any] = field(default_factory=dict)
    authorityGrant: Optional[AuthorityGrant] = None


@dataclass
class Receipt:
    receiptId: str
    decision: Decision
    mode: DecisionMode
    hash: str
    chainHash: str


@dataclass
class AuthorizeResponse:
    decision: Decision
    mode: DecisionMode
    reasonCodes: List[str]
    constraintsApplied: List[str]
    receipt: Receipt


def authorize(req: AuthorizeRequest) -> AuthorizeResponse:
    body = asdict(req)
    base_url = body.pop("base_url")
    payload = json.dumps(body).encode("utf-8")

    http_req = urllib_request.Request(
        url=f"{base_url.rstrip('/')}/re/authorize",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib_request.urlopen(http_req) as response:
        data = json.loads(response.read().decode("utf-8"))

    receipt = Receipt(
        receiptId=data["receipt"]["receiptId"],
        decision=Decision(data["receipt"]["decision"]["outcome"]),
        mode=DecisionMode(data["receipt"]["decision"]["mode"]),
        hash=data["receipt"]["integrity"]["hash"],
        chainHash=data["receipt"]["integrity"].get("chainHash", ""),
    )

    return AuthorizeResponse(
        decision=Decision(data["decision"]),
        mode=DecisionMode(data["mode"]),
        reasonCodes=data.get("reasonCodes", []),
        constraintsApplied=data.get("constraintsApplied", []),
        receipt=receipt,
    )
