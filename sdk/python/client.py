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
    CONSTRAIN = "CONSTRAIN"


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
    requestId: str
    decision: Decision
    chainHash: str
    prevChainHash: Optional[str]
    timestamp: str


@dataclass
class AuthorizeResponse:
    decision: Decision
    reason: str
    constraints: List[str]
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
        requestId=data["receipt"]["requestId"],
        decision=Decision(data["receipt"]["decision"]),
        chainHash=data["receipt"]["chainHash"],
        prevChainHash=data["receipt"].get("prevChainHash"),
        timestamp=data["receipt"]["timestamp"],
    )

    return AuthorizeResponse(
        decision=Decision(data["decision"]),
        reason=data["reason"],
        constraints=data.get("constraints", []),
        receipt=receipt,
    )
