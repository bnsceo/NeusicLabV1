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
WAVE_ROOT = ROOT / "wave-loom"
LIVE_ROOT = ROOT / "live-loop"
HOST = os.getenv("NEUSIC_HERMES_HOST", "127.0.0.1")
PORT = int(os.getenv("NEUSIC_HERMES_PORT", "8787"))
PROFILE = os.getenv("NEUSIC_HERMES_PROFILE", "").strip()
MODEL = os.getenv("NEUSIC_HERMES_MODEL", "").strip()
PROVIDER = os.getenv("NEUSIC_HERMES_PROVIDER", "").strip()
TOKEN = os.getenv("NEUSIC_HERMES_TOKEN", "").strip()
TIMEOUT = int(os.getenv("NEUSIC_HERMES_TIMEOUT", "120"))
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

CREATOR_STYLE = """<style id="neusic-creator-credit-style">
:root{--neusic-credit-safe:14px;--neusic-credit-primary:#d4a354;--neusic-credit-secondary:#f0c77d;--neusic-credit-tertiary:#68d8ff}
.neusic-creator-credit{position:fixed;z-index:100000;max-width:calc(100vw - 16px);padding:3px 7px;pointer-events:none;border:1px solid color-mix(in srgb,var(--neusic-credit-primary) 30%,transparent);background:rgba(2,7,10,.9);font:700 6px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.42),inset 0 0 12px color-mix(in srgb,var(--neusic-credit-primary) 8%,transparent);isolation:isolate}
.neusic-creator-credit span{display:block;color:transparent;background:linear-gradient(90deg,var(--neusic-credit-primary),var(--neusic-credit-secondary),var(--neusic-credit-tertiary),var(--neusic-credit-secondary),var(--neusic-credit-primary));background-size:320% 100%;background-position:0 50%;-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 3px color-mix(in srgb,var(--neusic-credit-primary) 65%,transparent));animation:neusic-credit-flow 5.2s linear infinite,neusic-credit-pulse 2.6s ease-in-out infinite alternate}
.neusic-creator-top{top:0;left:0;border-width:0 1px 1px 0;border-radius:0 0 5px 0}.neusic-creator-bottom{right:0;bottom:0;border-width:1px 0 0 1px;border-radius:5px 0 0 0}
@keyframes neusic-credit-flow{to{background-position:320% 50%}}@keyframes neusic-credit-pulse{from{opacity:.76;filter:drop-shadow(0 0 2px var(--neusic-credit-primary))}to{opacity:1;filter:drop-shadow(0 0 6px var(--neusic-credit-secondary))}}
body>.neusic-creator-top~#boot{inset:var(--neusic-credit-safe) 0!important}
body>.neusic-creator-top~iframe#studio{height:calc(100dvh - (var(--neusic-credit-safe) * 2))!important;margin-top:var(--neusic-credit-safe)!important;margin-bottom:var(--neusic-credit-safe)!important}
body>.neusic-creator-top~#app{height:calc(100dvh - (var(--neusic-credit-safe) * 2))!important;max-height:calc(100dvh - (var(--neusic-credit-safe) * 2))!important;margin-top:var(--neusic-credit-safe)!important;margin-bottom:var(--neusic-credit-safe)!important}
body>.neusic-creator-top~.topbar{top:var(--neusic-credit-safe)!important}
body>.neusic-creator-top~nav:first-of-type{top:var(--neusic-credit-safe)!important}
body>.neusic-creator-top~.workspace{padding-bottom:calc(8px + var(--neusic-credit-safe))!important}
body>.neusic-creator-top~.performance-shell{padding-top:calc(28px + var(--neusic-credit-safe))!important;padding-bottom:calc(40px + var(--neusic-credit-safe))!important}
body>.neusic-creator-bottom~#app #mobile-nav,body>.neusic-creator-bottom~#app .neusic-mobile-nav,body>.neusic-creator-bottom~.wave-mobile-dock{bottom:var(--neusic-credit-safe)!important}
@media(max-width:580px){.neusic-creator-credit{font-size:5px;letter-spacing:.08em;padding:2px 5px}:root{--neusic-credit-safe:11px}}
@media(prefers-reduced-motion:reduce){.neusic-creator-credit span{animation:none;background-position:50% 50%}}
</style>"""
CREATOR_MARKUP = """<div class="neusic-creator-credit neusic-creator-top" data-neusic-creator><span>Made by Anderson Paulino</span></div><div class="neusic-creator-credit neusic-creator-bottom" data-neusic-creator><span>Made by Anderson Paulino</span></div>"""
CREATOR_SCRIPT = """<script id="neusic-creator-credit-script">
(()=>{const root=document.documentElement,store="neusic-theme-v1";let last="";
const hex=v=>{const m=String(v||"").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(!m)return null;let s=m[1];if(s.length===3)s=[...s].map(x=>x+x).join("");return "#"+s.toLowerCase()};
const hsl=(value,turn=0,light=0)=>{const v=hex(value);if(!v)return null;let r=parseInt(v.slice(1,3),16)/255,g=parseInt(v.slice(3,5),16)/255,b=parseInt(v.slice(5,7),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2,d=max-min;if(d){s=d/(1-Math.abs(2*l-1));if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4)}h=(h+turn+360)%360;l=Math.max(.2,Math.min(.82,l+light));const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let a=0,q=0,z=0;if(h<60){a=c;q=x}else if(h<120){a=x;q=c}else if(h<180){q=c;z=x}else if(h<240){q=x;z=c}else if(h<300){a=x;z=c}else{a=c;z=x}return "#"+[a,q,z].map(n=>Math.round((n+m)*255).toString(16).padStart(2,"0")).join("")};
const css=()=>getComputedStyle(root),pick=()=>{let saved={};try{saved=JSON.parse(localStorage.getItem(store)||"{}")}catch(_){}const c=css(),read=n=>hex(c.getPropertyValue(n));const primary=hex(saved.accent)||read("--studio-accent")||read("--acc")||read("--accent")||read("--cyan")||"#d4a354";const secondary=hex(saved.bright)||read("--studio-accent-bright")||read("--accent-bright")||hsl(primary,18,.16)||primary;const tertiary=hsl(primary,118,.08)||"#68d8ff";return[primary,secondary,tertiary]};
const apply=()=>{const colors=pick(),key=colors.join("|");if(key===last)return;last=key;root.style.setProperty("--neusic-credit-primary",colors[0]);root.style.setProperty("--neusic-credit-secondary",colors[1]);root.style.setProperty("--neusic-credit-tertiary",colors[2])};apply();addEventListener("storage",apply);setInterval(apply,1000)})();
</script>"""


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


def verify_hermes(deep: bool = False) -> tuple[bool, str]:
    executable = shutil.which("hermes")
    if not executable:
        return False, "Hermes CLI is not installed or is not on PATH."
    if not deep:
        try:
            run = subprocess.run(
                [executable, "--version"],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
                env=os.environ.copy(),
            )
        except subprocess.TimeoutExpired:
            return True, "Hermes is installed; the version check was slow."
        detail = (run.stdout.strip() or run.stderr.strip() or "Hermes CLI found.")[:300]
        return run.returncode == 0, detail
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
        return False, "Hermes inference check timed out. Neusic can still run with Local Copilot."
    if run.returncode != 0:
        return False, (run.stderr.strip() or "Hermes inference check failed.")[:800]
    if not run.stdout.strip():
        return False, "Hermes returned an empty inference response."
    return True, run.stdout.strip()


def authorized(headers: Any) -> bool:
    if not TOKEN:
        return True
    auth = headers.get("Authorization", "")
    supplied = auth[7:].strip() if auth.lower().startswith("bearer ") else headers.get("X-Neusic-Token", "").strip()
    return bool(supplied) and hmac.compare_digest(supplied, TOKEN)


def safe_child(root: Path, relative: str) -> Path | None:
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def static_target(path: str) -> Path | None:
    clean = unquote(urlparse(path).path)
    if clean == "/":
        return ROOT / "index.html"
    if clean in {"/studio", "/studio/"}:
        return APP_ROOT / "phase-a.html"
    if clean == "/studio/core.html":
        return APP_ROOT / "index.html"
    if clean.startswith("/studio/"):
        return safe_child(APP_ROOT, clean.removeprefix("/studio/"))
    if clean in {"/wave-loom", "/wave-loom/"}:
        return WAVE_ROOT / "index.html"
    if clean.startswith("/wave-loom/"):
        return safe_child(WAVE_ROOT, clean.removeprefix("/wave-loom/"))
    if clean in {"/live-loop", "/live-loop/"}:
        return LIVE_ROOT / "index.html"
    if clean.startswith("/live-loop/"):
        return safe_child(LIVE_ROOT, clean.removeprefix("/live-loop/"))
    return None


def inject_creator_credit(html: str) -> str:
    if "data-neusic-creator" in html:
        return html
    if "</head>" in html:
        html = html.replace("</head>", f"{CREATOR_STYLE}</head>", 1)
    if "<body" in html:
        close = html.find(">", html.find("<body"))
        if close >= 0:
            html = html[: close + 1] + CREATOR_MARKUP + html[close + 1 :]
    if "</body>" in html:
        html = html.replace("</body>", f"{CREATOR_SCRIPT}</body>", 1)
    return html


class Handler(BaseHTTPRequestHandler):
    server_version = "NeusicHermesRuntime/2.3"

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
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix.lower() == ".html":
            data = inject_creator_credit(path.read_text(encoding="utf-8")).encode("utf-8")
            content_type = "text/html; charset=utf-8"
        else:
            data = path.read_bytes()
        self.send_response(200)
        self.security_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def redirect(self, location: str) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        self.security_headers()
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.cors()
        self.security_headers()
        self.end_headers()

    def do_GET(self) -> None:
        request_path = urlparse(self.path).path
        path = request_path.rstrip("/") or "/"
        if path == "/health":
            installed = bool(shutil.which("hermes"))
            self.json_reply(
                200,
                {
                    "status": "ok",
                    "service": "neusic-hermes-runtime",
                    "toolset": "context_engine",
                    "auth": "required" if TOKEN else "local-only",
                    "servingApp": bool(getattr(self.server, "serve_app", False)),
                    "hermesInstalled": installed,
                    "pages": ["/studio/", "/wave-loom/", "/live-loop/"],
                },
            )
            return
        if getattr(self.server, "serve_app", False):
            redirects = {"/studio": "/studio/", "/wave-loom": "/wave-loom/", "/live-loop": "/live-loop/"}
            if request_path in redirects:
                self.redirect(redirects[request_path])
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
            self.json_reply(503, {"error": "Hermes CLI was not found. Local Copilot remains available."})
            return
        except subprocess.TimeoutExpired:
            self.json_reply(504, {"error": "Hermes request timed out. Try Local Copilot or repair the configured provider."})
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
    parser.add_argument("--check", action="store_true", help="Run a lightweight Hermes CLI check without inference.")
    parser.add_argument("--deep-check", action="store_true", help="Run an actual Hermes inference diagnostic.")
    parser.add_argument("--check-only", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.check or args.deep_check or args.check_only:
        ok, detail = verify_hermes(deep=args.deep_check)
        print(f"Hermes check: {'OK' if ok else 'WARNING'} — {detail}")
        if args.check_only:
            return 0 if ok else 2
        if not ok:
            print("Starting Neusic anyway. Local Copilot remains available.")
    if args.host not in {"127.0.0.1", "localhost", "::1"} and not TOKEN:
        print("Refusing non-local bind without NEUSIC_HERMES_TOKEN.", file=sys.stderr)
        return 2
    try:
        server = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        print(f"Could not start Neusic on {args.host}:{args.port}: {exc}", file=sys.stderr)
        return 2
    server.serve_app = args.serve_app
    base = f"http://{args.host}:{args.port}"
    print(f"Neusic local runtime: {base}")
    print(f"Hermes endpoint: {base}/api/hermes")
    print("Tool access: disabled (context_engine only)")
    if TOKEN:
        print("Bridge authentication: bearer token required")
    if args.serve_app:
        print(f"Classic Studio: {base}/studio/")
        print(f"Wave Loom Lab: {base}/wave-loom/")
        print(f"Live Loop Lab: {base}/live-loop/")
        if args.open_browser:
            threading.Timer(0.5, lambda: webbrowser.open(f"{base}/studio/")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nNeusic local runtime stopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
