from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).resolve().parents[2] / "config" / "connectors.json"


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    if not CATALOG_PATH.exists():
        raise RuntimeError(f"connector catalog not found: {CATALOG_PATH}")
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if not isinstance(data.get("connectors"), list):
        raise RuntimeError("connector catalog is invalid")
    return data


def catalog_version() -> str:
    return str(load_catalog().get("version") or "unknown")


def list_connectors() -> list[dict[str, Any]]:
    return [dict(item) for item in load_catalog()["connectors"]]


def get_connector_definition(connector_id: str) -> dict[str, Any] | None:
    return next((item for item in list_connectors() if item.get("id") == connector_id), None)


def get_action_definition(connector_id: str, action_id: str) -> dict[str, Any] | None:
    connector = get_connector_definition(connector_id)
    if not connector:
        return None
    return next((dict(item) for item in connector.get("actions", []) if item.get("id") == action_id), None)
