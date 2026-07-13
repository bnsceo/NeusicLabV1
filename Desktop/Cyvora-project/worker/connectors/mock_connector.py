from __future__ import annotations

import hashlib
import json

from .base import ConnectorRequest, ConnectorResult
from .catalog import get_action_definition, get_connector_definition


class MockConnector:
    name = "mock"

    def __init__(self, provider_name: str = "generic") -> None:
        self.provider_name = provider_name
        self.definition = get_connector_definition(provider_name)
        if self.definition is None:
            raise ValueError(f"unknown connector: {provider_name}")

    def execute(self, request: ConnectorRequest) -> ConnectorResult:
        action = get_action_definition(self.provider_name, request.action)
        if action is None:
            raise ValueError(f"unknown action '{request.action}' for connector '{self.provider_name}'")
        key_material = request.idempotency_key or json.dumps(
            [request.tenant, request.company_id, request.task_id, self.provider_name, request.action, request.payload],
            sort_keys=True,
            default=str,
        )
        reference = f"mock_{self.provider_name}_" + hashlib.sha256(key_material.encode("utf-8")).hexdigest()[:16]
        return ConnectorResult(
            provider=f"mock:{self.provider_name}",
            action=request.action,
            status="simulated",
            external_reference=reference,
            reversible=bool(action.get("reversible", True)),
            simulated=True,
            cost_usd=0.0,
            details={
                "message": "Connector action simulated. No external service was contacted and no secret was used.",
                "connector": self.definition.get("name"),
                "payload": request.payload,
                "risk": action.get("risk", "medium"),
                "side_effect": action.get("sideEffect", "write"),
                "sensitive_data": request.sensitive_data,
                "requested_by": request.requested_by,
            },
        )
