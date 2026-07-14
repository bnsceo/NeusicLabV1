#!/usr/bin/env python3
"""Unified Neusic + Hermes local runtime and secure advisory bridge."""
from __future__ import annotations

import argparse
import hmac
import json
import mimetypes
import os
import shutil
import subprocess
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = ROOT / "app"
HOST = os.getenv("NEUSIC_HERMES_HOST", "127.0.0.1")
PORT = int(os.getenv("NEUSIC_HERMES_PORT", "8787"))
PROFILE = os.getenv("NEUSIC_HERMES_PROFILE", "").strip()
MODEL = os.getenv("NEUSIC_HERMES_MODEL", "").strip()
PROVIDER = os.getenv("NEUSIC_HERMES_PROVIDER", "").strip()
TOKEN = os.getenv("NEUSIC_HERMES_TOKEN", "").strip()
TIMEOUT = int(os.getenv("NEUSIC_HERMES_TIMEOUT", "90"))
MAX_BODY = int(os.getenv("NEUSIC_HERMES_MAX_BODY", "65536"))
SERVE_APP = os.getenv("NEUSIC_SERVE_APP", "0").lower() in {"1", "true", "yes"}
ALLOWED = {
    item.strip()
    for item in os.getenv(
        "NEUSIC_ALLOWED_ORIGINS",
        "http://localhost:8787,http://127.0.0.1:8787,http://localhost:8000,http://127.0.0.1:8000,https://bnsceo.github.io",
    ).split(",")
    if item.strip()
}


def compact(value: Any, limit: int = 24000) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))[:limit]


def make_prompt(question: str, context: dict[str, Any]) -> str:
    return f"""You are the Neusic Production Copilot, an expert music-production advisor inside a DAW.
Analyze only the structured project summary below. No raw audio is available.
Give practical advice about arrangement, recording readiness, track roles, gain staging and workflow.
Never claim to have heard the music. Never claim an action was applied. Do not output shell commands.
Keep the answer under 450 words and use concise numbered recommendations when useful.

PROJECT_CONTEXT_JSON:
{compact(context)}

PRODUCER_REQUEST:
{question[:8000]}
"""


def hermes_command(prompt: str) -> list[str]:
    command = ["hermes"]
    if PROFILE:
        command += ["--profile", PROFILE]
    if os.getenv("NEUSIC_HERMES_USE_MEMORY", "0").lower() not in {"1", "true", "yes"}:
        command += ["--ignore-rules"]
    command += ["-z", prompt, "--toolsets", "context_engine"]
    if PROVIDER and MODEL:
        command += ["--provider", PROVIDER, "--model", MODEL]
    elif MODEL:
        command += ["--model", MODEL]
    return command


def verify_hermes() -> tuple[bool, str]:
    if not shutil.which("hermes"):
        return False, "Hermes CLI is not installed or is not on PATH."
    try:
        run = subprocess.run(
            hermes_command("Reply exactly READY."),
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
            check=False,
            env=os.environ.copy(),
        )
    except subprocess.TimeoutExpired:
        return False, "Hermes startup check timed out."
    if run.returncode != 0:
        return False, (run.stderr.strip() or "Hermes startup check failed.")[:800]
    if not run.stdout.strip():
        return False, "Hermes returned an empty startup response."
    return True, run.stdout.strip()


def authorized(headers: Any) -> bool:
    if not TOKEN:
        return True
    auth = headers.get("Authorization", "")
    supplied = auth[7:].strip() if auth.lower().startswith("bearer ") else headers.get("X-Neusic-Token", "").strip()
    return bool(supplied) and hmac.compare_digest(supplied, TOKEN)


def static_target(path: str) -> Path | None:
    clean = unquote(urlparse(path).path)
    if clean == "/":
        return ROOT / "index.html"
    if clean in {"/studio", "/studio/"}:
        return APP_ROOT / "phase-a.html"
    if clean == "/studio/core.html":
        return APP_ROOT / "index.html"
    if clean.startswith("/studio/"):
        relative = clean.removeprefix("/studio/")
        candidate = (APP_ROOT / relative).resolve()
        try:
            candidate.relative_to(APP_ROOT.resolve())
        except ValueError:
            return None
        return candidate
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = "NeusicHermesRuntime/2.0"

    def security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")

    def cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Neusic-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def json_reply(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.cors()
        self.security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def file_reply(self, path: Path) -> None:
        if not path.is_file():
            self.json_reply(404, {"error": "Not found"})
            return
        data = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.security_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.cors()
        self.security_headers()
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/health":
            self.json_reply(
                200,
                {
                    "status": "ok",
                    "service": "neusic-hermes-runtime",
                    "toolset": "context_engine",
                    "auth": "required" if TOKEN else "local-only",
                    "servingApp": bool(getattr(self.server, "serve_app", False)),
                },
            )
            return
        if getattr(self.server, "serve_app", False):
            if urlparse(self.path).path == "/studio":
                self.send_response(302)
                self.send_header("Location", "/studio/")
                self.end_headers()
                return
            target = static_target(self.path)
            if target:
                self.file_reply(target)
                return
        self.json_reply(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if urlparse(self.path).path.rstrip("/") != "/api/hermes":
            self.json_reply(404, {"error": "Not found"})
            return
        origin = self.headers.get("Origin", "")
        server_port = self.server.server_address[1]
        local_origins = {f"http://127.0.0.1:{server_port}", f"http://localhost:{server_port}"}
        if origin and origin not in ALLOWED and origin not in local_origins:
            self.json_reply(403, {"error": "Origin not allowed"})
            return
        if not authorized(self.headers):
            self.json_reply(401, {"error": "Bridge token required"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self.json_reply(413, {"error": "Invalid request size"})
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except Exception:
            self.json_reply(400, {"error": "Invalid JSON"})
            return
        question = str(payload.get("prompt", "")).strip()
        context = payload.get("context")
        if not question or not isinstance(context, dict):
            self.json_reply(400, {"error": "prompt and context are required"})
            return
        try:
            run = subprocess.run(
                hermes_command(make_prompt(question, context)),
                capture_output=True,
                text=True,
                timeout=TIMEOUT,
                check=False,
                env=os.environ.copy(),
            )
        except FileNotFoundError:
            self.json_reply(503, {"error": "Hermes CLI was not found on this machine"})
            return
        except subprocess.TimeoutExpired:
            self.json_reply(504, {"error": "Hermes request timed out"})
            return
        if run.returncode != 0:
            self.json_reply(502, {"error": (run.stderr.strip() or "Hermes exited with an error")[:800]})
            return
        answer = run.stdout.strip()
        if not answer:
            self.json_reply(502, {"error": "Hermes returned an empty response"})
            return
        self.json_reply(200, {"reply": answer, "provider": "hermes", "tools": "disabled"})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[neusic-hermes] {fmt % args}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Neusic Hermes bridge or the unified local studio runtime.")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--serve-app", action="store_true", default=SERVE_APP)
    parser.add_argument("--open", action="store_true", dest="open_browser")
    parser.add_argument("--check", action="store_true", help="Verify Hermes before starting.")
    parser.add_argument("--check-only", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.check or args.check_only:
        ok, detail = verify_hermes()
        print(f"Hermes check: {'OK' if ok else 'FAILED'} — {detail}")
        if not ok:
            return 2
        if args.check_only:
            return 0
    if args.host not in {"127.0.0.1", "localhost", "::1"} and not TOKEN:
        print("Refusing non-local bind without NEUSIC_HERMES_TOKEN.", file=sys.stderr)
        return 2
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.serve_app = args.serve_app
    base = f"http://{args.host}:{args.port}"
    print(f"Neusic Hermes runtime: {base}")
    print(f"Hermes endpoint: {base}/api/hermes")
    print(f"Tool access: disabled (context_engine only)")
    if TOKEN:
        print("Bridge authentication: bearer token required")
    if args.serve_app:
        print(f"Neusic Studio: {base}/studio/")
        if args.open_browser:
            threading.Timer(0.5, lambda: webbrowser.open(f"{base}/studio/")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nNeusic Hermes runtime stopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
