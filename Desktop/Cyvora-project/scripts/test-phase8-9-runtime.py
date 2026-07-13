#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "worker"))
os.environ["CYVORA_CONNECTOR_MODE"] = "mock"
os.environ["ALLOW_PAID_AI"] = "false"

from connectors import ConnectorRequest, get_action_definition, get_connector, list_connectors, public_connector_status  # noqa: E402
from policy import evaluate_connector_policy, get_policy_pack  # noqa: E402


def main() -> int:
    connectors = list_connectors()
    assert len(connectors) >= 9
    assert public_connector_status()["real_actions_enabled"] is False
    assert public_connector_status()["cost_usd"] == 0.0

    low_action = get_action_definition("github", "search_repositories")
    assert low_action and low_action["risk"] == "low"
    low_decision = evaluate_connector_policy(
        risk=low_action["risk"],
        side_effect=low_action["sideEffect"],
        reversible=low_action["reversible"],
        connector_mode="mock",
        policy_pack_id="founder-safe",
    )
    assert low_decision.effect == "simulate"
    assert low_decision.estimated_cost_usd == 0.0

    high_action = get_action_definition("gmail", "send_email")
    assert high_action
    high_decision = evaluate_connector_policy(
        risk=high_action["risk"],
        side_effect=high_action["sideEffect"],
        reversible=high_action["reversible"],
        connector_mode="mock",
        policy_pack_id="founder-safe",
    )
    assert high_decision.effect == "require_approval"
    approved = evaluate_connector_policy(
        risk=high_action["risk"],
        side_effect=high_action["sideEffect"],
        reversible=high_action["reversible"],
        connector_mode="mock",
        policy_pack_id="founder-safe",
        founder_approved=True,
    )
    assert approved.effect == "simulate"

    critical_action = get_action_definition("stripe", "refund_payment")
    assert critical_action
    locked = evaluate_connector_policy(
        risk=critical_action["risk"],
        side_effect=critical_action["sideEffect"],
        reversible=critical_action["reversible"],
        connector_mode="mock",
        policy_pack_id="locked-down",
    )
    assert locked.effect == "block"

    connector = get_connector("github")
    first = connector.execute(ConnectorRequest(action="search_repositories", payload={"query": "cyvora"}, tenant="default", idempotency_key="same"))
    second = connector.execute(ConnectorRequest(action="search_repositories", payload={"query": "changed"}, tenant="default", idempotency_key="same"))
    assert first.external_reference == second.external_reference
    assert first.cost_usd == 0.0
    assert first.simulated is True

    assert get_policy_pack("founder-safe")["allowPaidAi"] is False
    print("Phase 8 connector framework and Phase 9 policy engine tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
