#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)


def run() -> dict:
    timestamp = datetime.now(timezone.utc).isoformat()

    watcher_summary = "No live market data in dry-run mode."
    strategy_output = [
        {
            "symbol": "SPY",
            "action": "skip",
            "reason": "Dry-run placeholder",
        }
    ]
    risk_result = {
        "status": "reject",
        "reason": "Dry-run mode does not place orders.",
    }
    human_decision = "reject"
    final_result = "no_trade"

    record = {
        "timestamp": timestamp,
        "mode": "dry-run",
        "watcher_summary": watcher_summary,
        "strategy_output": strategy_output,
        "risk_result": risk_result,
        "human_decision": human_decision,
        "final_result": final_result,
    }

    log_path = LOG_DIR / f"run-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    log_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return {"log_path": str(log_path), "record": record}


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))

