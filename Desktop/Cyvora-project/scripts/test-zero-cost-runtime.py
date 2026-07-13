#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "worker"))

os.environ["CYVORA_MODEL_PROVIDER"] = "mock"
os.environ["CYVORA_CONNECTOR_MODE"] = "mock"
os.environ["ALLOW_PAID_AI"] = "false"
os.environ["MOCK_MODE"] = "true"

from connectors import ConnectorRequest, get_connector  # noqa: E402
from policy import decide_execution_policy  # noqa: E402
from providers import ModelRequest, get_provider  # noqa: E402


def main() -> int:
    provider = get_provider()
    response = provider.execute(ModelRequest(system="test", user="test", max_tokens=100))
    assert response.usage.provider == "mock"
    assert response.usage.actual_cost_usd == 0.0
    assert "No paid model" in response.text

    connector = get_connector("github")
    result = connector.execute(
        ConnectorRequest(
            action="create_pull_request",
            payload={"title": "Mock PR"},
            tenant="default",
            company_id=1,
            task_id=1,
        )
    )
    assert result.simulated is True
    assert result.status == "simulated"
    assert result.external_reference and result.external_reference.startswith("mock_")

    decision = decide_execution_policy(
        {"risk_level": "high", "validation_policy": "schema"},
        {"mock_mode": 1},
    )
    assert decision.provider == "mock"
    assert decision.connector_mode == "mock"
    assert decision.external_actions_allowed is False
    assert decision.requires_human_result_approval is True

    print("Zero-cost provider, connector, and policy smoke tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
