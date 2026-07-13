from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class ConnectorRequest:
    action: str
    payload: dict[str, Any]
    tenant: str
    company_id: int | None = None
    task_id: int | None = None
    idempotency_key: str | None = None
    sensitive_data: str = "none"
    requested_by: str = "agent"


@dataclass(frozen=True)
class ConnectorResult:
    provider: str
    action: str
    status: str
    external_reference: str | None = None
    reversible: bool = True
    simulated: bool = True
    cost_usd: float = 0.0
    details: dict[str, Any] = field(default_factory=dict)


class ConnectorProvider(Protocol):
    name: str

    def execute(self, request: ConnectorRequest) -> ConnectorResult:
        ...
