from __future__ import annotations

import os
import time

from .base import ModelRequest, ModelResponse, ModelUsage


class AnthropicProvider:
    name = "anthropic"

    def __init__(self) -> None:
        self.model = os.environ.get("SUPERVISOR_MODEL", "claude-sonnet-5")

    def execute(self, request: ModelRequest) -> ModelResponse:
        try:
            import anthropic
        except ImportError as exc:
            raise RuntimeError("anthropic package not installed") from exc

        started = time.perf_counter()
        client = anthropic.Anthropic()
        response = client.messages.create(
            model=self.model,
            max_tokens=request.max_tokens,
            system=request.system,
            messages=[{"role": "user", "content": request.user}],
        )
        latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        text_blocks = [block.text for block in response.content if block.type == "text"]
        if not text_blocks:
            raise RuntimeError("model returned no text content")

        input_tokens = int(getattr(response.usage, "input_tokens", 0) or 0)
        output_tokens = int(getattr(response.usage, "output_tokens", 0) or 0)
        cached_tokens = int(getattr(response.usage, "cache_read_input_tokens", 0) or 0)
        input_rate = float(os.environ.get("CYVORA_INPUT_COST_PER_MTOKEN", "3.0"))
        output_rate = float(os.environ.get("CYVORA_OUTPUT_COST_PER_MTOKEN", "15.0"))
        estimate = (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000

        return ModelResponse(
            text="".join(text_blocks),
            usage=ModelUsage(
                provider=self.name,
                model=self.model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cached_tokens=cached_tokens,
                estimated_cost_usd=round(estimate, 6),
                actual_cost_usd=None,
                provider_request_id=getattr(response, "id", None),
                latency_ms=latency_ms,
            ),
        )
