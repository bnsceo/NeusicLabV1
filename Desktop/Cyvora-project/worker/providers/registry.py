from __future__ import annotations

import os

from .anthropic_provider import AnthropicProvider
from .base import ModelProvider
from .mock_provider import MockProvider


class ProviderConfigurationError(RuntimeError):
    pass


def configured_provider_name() -> str:
    explicit = os.environ.get("CYVORA_MODEL_PROVIDER", "").strip().lower()
    if explicit:
        return explicit
    mock_mode = os.environ.get("MOCK_MODE", "true").lower() in {"1", "true", "yes", "on"}
    return "mock" if mock_mode else "anthropic"


def get_provider(name: str | None = None) -> ModelProvider:
    selected = (name or configured_provider_name()).strip().lower()
    if selected == "mock":
        return MockProvider()
    if selected == "anthropic":
        allow_paid = os.environ.get("ALLOW_PAID_AI", "false").lower() in {"1", "true", "yes", "on"}
        if not allow_paid:
            raise ProviderConfigurationError(
                "Anthropic provider requested while ALLOW_PAID_AI is disabled. Use CYVORA_MODEL_PROVIDER=mock."
            )
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise ProviderConfigurationError("ANTHROPIC_API_KEY is required for the Anthropic provider")
        return AnthropicProvider()
    raise ProviderConfigurationError(f"unsupported model provider: {selected}")


def public_provider_status() -> dict[str, object]:
    selected = configured_provider_name()
    allow_paid = os.environ.get("ALLOW_PAID_AI", "false").lower() in {"1", "true", "yes", "on"}
    return {
        "selected": selected,
        "paid_ai_allowed": allow_paid,
        "mock_safe": selected == "mock",
        "available": ["mock", "anthropic"],
    }
