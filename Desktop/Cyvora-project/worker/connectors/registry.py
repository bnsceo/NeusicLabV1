from __future__ import annotations

import os

from .base import ConnectorProvider
from .catalog import catalog_version, get_connector_definition, list_connectors
from .mock_connector import MockConnector


class ConnectorConfigurationError(RuntimeError):
    pass


def connector_mode() -> str:
    return os.environ.get("CYVORA_CONNECTOR_MODE", "mock").strip().lower()


def get_connector(provider_name: str) -> ConnectorProvider:
    if get_connector_definition(provider_name) is None:
        raise ConnectorConfigurationError(f"unknown connector provider '{provider_name}'")
    mode = connector_mode()
    if mode == "mock":
        return MockConnector(provider_name=provider_name)
    if mode == "disabled":
        raise ConnectorConfigurationError("connector execution is disabled")
    raise ConnectorConfigurationError(
        f"real connector mode is not implemented for provider '{provider_name}'. Set CYVORA_CONNECTOR_MODE=mock."
    )


def public_connector_status() -> dict[str, object]:
    mode = connector_mode()
    connectors = list_connectors()
    return {
        "catalog_version": catalog_version(),
        "mode": mode,
        "mock_safe": mode == "mock",
        "real_actions_enabled": False,
        "connector_count": len(connectors),
        "action_count": sum(len(item.get("actions", [])) for item in connectors),
        "cost_usd": 0.0,
    }
