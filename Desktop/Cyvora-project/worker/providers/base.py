from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ModelRequest:
    system: str
    user: str
    max_tokens: int
    task_id: int | None = None
    execution_run_id: int | None = None


@dataclass(frozen=True)
class ModelUsage:
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cached_tokens: int = 0
    estimated_cost_usd: float = 0.0
    actual_cost_usd: float | None = None
    provider_request_id: str | None = None
    latency_ms: int = 0

    def as_dict(self) -> dict[str, object]:
        return {
            "provider": self.provider,
            "model": self.model,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cached_tokens": self.cached_tokens,
            "estimated_cost_usd": self.estimated_cost_usd,
            "actual_cost_usd": self.actual_cost_usd,
            "provider_request_id": self.provider_request_id,
            "latency_ms": self.latency_ms,
        }


@dataclass(frozen=True)
class ModelResponse:
    text: str
    usage: ModelUsage


class ModelProvider(Protocol):
    name: str

    def execute(self, request: ModelRequest) -> ModelResponse:
        ...
