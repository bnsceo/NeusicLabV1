#!/usr/bin/env python3
"""Start Neusic Studio with the local Hermes Production Copilot."""
from __future__ import annotations

import sys
from pathlib import Path

BRIDGE = Path(__file__).resolve().parent / "integrations" / "hermes-bridge"
sys.path.insert(0, str(BRIDGE))

from server import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main(["--serve-app", "--open", "--check", *sys.argv[1:]]))
