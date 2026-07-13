from __future__ import annotations

import json
import time

from .base import ModelRequest, ModelResponse, ModelUsage


class MockProvider:
    name = "mock"

    def execute(self, request: ModelRequest) -> ModelResponse:
        started = time.perf_counter()
        payload = {
            "summary": "Mock run completed deterministically.",
            "deliverable": (
                "Mock-mode candidate deliverable produced through the Cyvora provider registry. "
                "No paid model or external API was called."
            ),
            "status": "completed",
            "confidence": 0.5,
            "next_action": None,
        }
        latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        return ModelResponse(
            text=json.dumps(payload),
            usage=ModelUsage(
                provider=self.name,
                model="deterministic-mock-v1",
                input_tokens=0,
                output_tokens=0,
                estimated_cost_usd=0.0,
                actual_cost_usd=0.0,
                latency_ms=latency_ms,
            ),
        )
