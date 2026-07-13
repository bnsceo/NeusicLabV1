from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

POLICY_PATH = Path(__file__).resolve().parents[1] / "config" / "policy-packs.json"


@lru_cache(maxsize=1)
def load_policy_config() -> dict[str, Any]:
    data = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    if not data.get("defaultPack") or not isinstance(data.get("packs"), list):
        raise RuntimeError("policy pack configuration is invalid")
    return data


def get_policy_pack(pack_id: str | None = None) -> dict[str, Any]:
    config = load_policy_config()
    selected = pack_id or str(config["defaultPack"])
    for pack in config["packs"]:
        if pack.get("id") == selected:
            return dict(pack)
    return get_policy_pack(str(config["defaultPack"]))


@dataclass(frozen=True)
class ConnectorPolicyDecision:
    policy_pack: str
    effect: str
    after_approval_effect: str
    risk: str
    side_effect: str
    reason: str
    matched_rules: tuple[str, ...]
    requires_founder_approval: bool
    external_action_allowed: bool
    mock_safe: bool
    estimated_cost_usd: float


@dataclass(frozen=True)
class ExecutionPolicyDecision:
    provider: str
    validation_policy: str
    requires_human_result_approval: bool
    external_actions_allowed: bool
    connector_mode: str
    reason: str
    policy_pack: str = "founder-safe"
    effect: str = "simulate"
    matched_rules: tuple[str, ...] = ()


def evaluate_connector_policy(
    *,
    risk: str,
    side_effect: str,
    reversible: bool,
    connector_mode: str = "mock",
    provider_mode: str = "mock",
    estimated_cost_usd: float = 0.0,
    sensitive_data: str = "none",
    environment: str = "founder",
    actor_role: str = "agent",
    founder_approved: bool = False,
    policy_pack_id: str | None = None,
) -> ConnectorPolicyDecision:
    pack = get_policy_pack(policy_pack_id)
    risk = str(risk or "medium").lower()
    side_effect = str(side_effect or "write").lower()
    connector_mode = str(connector_mode or "mock").lower()
    cost = max(0.0, float(estimated_cost_usd or 0.0))
    execution_effect = "simulate" if connector_mode == "mock" else "allow"
    if connector_mode == "disabled":
        execution_effect = "block"

    matched: list[str] = []
    effect = execution_effect
    reason = "Mock connector execution is permitted at $0 cost." if connector_mode == "mock" else "Action permitted."

    if connector_mode == "disabled":
        matched.append("connector_mode_disabled")
        effect = "block"
        reason = "Connector execution is disabled."
    if provider_mode == "real" and cost > 0 and not bool(pack.get("allowPaidAi")):
        matched.append("paid_ai_disabled")
        effect = "block"
        reason = "Paid AI execution is disabled by this policy pack."
    if cost > float(pack.get("maxAutoCostUsd", 0)):
        matched.append("cost_above_auto_limit")
        effect = "block"
        reason = f"Estimated cost ${cost:.4f} exceeds the automatic limit."
    if connector_mode == "real" and not bool(pack.get("allowRealConnectors")):
        matched.append("real_connectors_disabled")
        effect = "block"
        reason = "Real connector execution is disabled by this policy pack."
    if side_effect in set(pack.get("blockedSideEffects", [])):
        matched.append(f"blocked_side_effect:{side_effect}")
        effect = "block"
        reason = f"{side_effect} actions are blocked by the selected policy pack."

    if risk == "critical":
        critical_rule = str(pack.get("criticalRule", "require_approval"))
        matched.append(f"critical_action:{critical_rule}")
        if critical_rule == "block":
            effect = "block"
            reason = "Critical actions are blocked by this policy pack."
        elif effect != "block":
            effect = execution_effect if founder_approved else "require_approval"
            reason = "Founder approval satisfied for a critical action." if founder_approved else "Critical actions require founder approval."

    sensitive_external = sensitive_data != "none" and side_effect not in {"read", "write"}
    if sensitive_external and effect != "block":
        rule = str(pack.get("sensitiveExternalRule", "require_approval"))
        matched.append(f"sensitive_external:{rule}")
        if rule == "block":
            effect = "block"
            reason = "Sensitive data cannot be sent through this external action."
        elif rule == "require_approval":
            effect = execution_effect if founder_approved else "require_approval"
            reason = "Founder approval satisfied for sensitive external data." if founder_approved else "Sensitive external data requires founder approval."

    needs_approval = risk in set(pack.get("approvalRisks", [])) or side_effect in set(pack.get("approvalSideEffects", []))
    if needs_approval and effect != "block":
        matched.append(f"approval_gate:{risk}:{side_effect}")
        effect = execution_effect if founder_approved else "require_approval"
        reason = "Founder approval satisfied; the governed action may proceed." if founder_approved else f"{risk} risk or {side_effect} side effects require founder approval."

    if environment == "demo" and side_effect != "read":
        matched.append("public_demo_read_only")
        effect = "block"
        reason = "The public demo is read-only."
    if actor_role == "agent" and not reversible and effect != "block":
        matched.append("irreversible_agent_action")
        effect = execution_effect if founder_approved else "require_approval"
        reason = "Founder approval satisfied for an irreversible action." if founder_approved else "Irreversible agent actions require founder approval."
    if founder_approved and effect != "block":
        matched.append("founder_approval_satisfied")
    if not matched:
        matched.append("mock_safe_default" if connector_mode == "mock" else "policy_default_allow")

    return ConnectorPolicyDecision(
        policy_pack=str(pack["id"]),
        effect=effect,
        after_approval_effect=execution_effect,
        risk=risk,
        side_effect=side_effect,
        reason=reason,
        matched_rules=tuple(matched),
        requires_founder_approval=effect == "require_approval",
        external_action_allowed=effect == "allow",
        mock_safe=effect == "simulate" or (effect == "require_approval" and connector_mode == "mock"),
        estimated_cost_usd=cost,
    )


def decide_execution_policy(task: dict[str, Any], run: dict[str, Any]) -> ExecutionPolicyDecision:
    risk = str(task.get("approval_risk_level") or task.get("risk_level") or "medium").lower()
    requested_validation = str(task.get("validation_policy") or "schema").lower()
    mock_mode = bool(run.get("mock_mode", 1))
    pack_id = str(task.get("policy_pack") or run.get("policy_pack") or "founder-safe")

    requires_human = risk in {"high", "critical"} or requested_validation in {
        "human", "consensus_human", "result_approval",
    }
    connector = "mock" if mock_mode else "disabled"
    connector_decision = evaluate_connector_policy(
        risk=risk,
        side_effect="write",
        reversible=True,
        connector_mode=connector,
        provider_mode="mock" if mock_mode else "real",
        policy_pack_id=pack_id,
    )

    return ExecutionPolicyDecision(
        provider="mock" if mock_mode else "configured",
        validation_policy=requested_validation or "schema",
        requires_human_result_approval=requires_human,
        external_actions_allowed=connector_decision.external_action_allowed,
        connector_mode=connector,
        reason=(
            "Mock-safe execution selected. External side effects remain simulated and governed."
            if mock_mode else
            "Live model execution may be configured, but real connector actions remain policy-gated."
        ),
        policy_pack=connector_decision.policy_pack,
        effect=connector_decision.effect,
        matched_rules=connector_decision.matched_rules,
    )
