#!/usr/bin/env python3
"""Dependency-free Neusic-to-Hermes bridge.

Neusic sends structured project metadata only. Hermes runs in scripted one-shot
mode with the empty context_engine toolset, so this bridge is advisory-only.
"""
from __future__ import annotations
import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

HOST=os.getenv("NEUSIC_HERMES_HOST","127.0.0.1")
PORT=int(os.getenv("NEUSIC_HERMES_PORT","8787"))
PROFILE=os.getenv("NEUSIC_HERMES_PROFILE","").strip()
MODEL=os.getenv("NEUSIC_HERMES_MODEL","").strip()
PROVIDER=os.getenv("NEUSIC_HERMES_PROVIDER","").strip()
TIMEOUT=int(os.getenv("NEUSIC_HERMES_TIMEOUT","90"))
MAX_BODY=int(os.getenv("NEUSIC_HERMES_MAX_BODY","65536"))
ALLOWED={x.strip() for x in os.getenv("NEUSIC_ALLOWED_ORIGINS","http://localhost:8000,http://127.0.0.1:8000,https://bnsceo.github.io").split(",") if x.strip()}

def compact(value:Any,limit:int=24000)->str:
    return json.dumps(value,ensure_ascii=False,separators=(",",":"))[:limit]

def make_prompt(question:str,context:dict[str,Any])->str:
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

def command(prompt:str)->list[str]:
    cmd=["hermes"]
    if PROFILE:cmd += ["--profile",PROFILE]
    if os.getenv("NEUSIC_HERMES_USE_MEMORY","0").lower() not in {"1","true","yes"}:cmd += ["--ignore-rules"]
    cmd += ["-z",prompt,"--toolsets","context_engine"]
    if PROVIDER and MODEL:cmd += ["--provider",PROVIDER,"--model",MODEL]
    elif MODEL:cmd += ["--model",MODEL]
    return cmd

class Handler(BaseHTTPRequestHandler):
    server_version="NeusicHermesBridge/1.0"
    def cors(self)->None:
        origin=self.headers.get("Origin","")
        if origin in ALLOWED:
            self.send_header("Access-Control-Allow-Origin",origin)
            self.send_header("Vary","Origin")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
        self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS")
    def reply(self,status:int,payload:dict[str,Any])->None:
        data=json.dumps(payload,ensure_ascii=False).encode()
        self.send_response(status);self.cors();self.send_header("Content-Type","application/json; charset=utf-8");self.send_header("Content-Length",str(len(data)));self.end_headers();self.wfile.write(data)
    def do_OPTIONS(self)->None:
        self.send_response(204);self.cors();self.end_headers()
    def do_GET(self)->None:
        if self.path.rstrip("/")=="/health":self.reply(200,{"status":"ok","service":"neusic-hermes-bridge","toolset":"context_engine"})
        else:self.reply(404,{"error":"Not found"})
    def do_POST(self)->None:
        if self.path.rstrip("/")!="/api/hermes":self.reply(404,{"error":"Not found"});return
        origin=self.headers.get("Origin","")
        if origin and origin not in ALLOWED:self.reply(403,{"error":"Origin not allowed"});return
        try:length=int(self.headers.get("Content-Length","0"))
        except ValueError:length=0
        if length<=0 or length>MAX_BODY:self.reply(413,{"error":"Invalid request size"});return
        try:payload=json.loads(self.rfile.read(length))
        except Exception:self.reply(400,{"error":"Invalid JSON"});return
        question=str(payload.get("prompt","")).strip();context=payload.get("context")
        if not question or not isinstance(context,dict):self.reply(400,{"error":"prompt and context are required"});return
        try:run=subprocess.run(command(make_prompt(question,context)),capture_output=True,text=True,timeout=TIMEOUT,check=False,env=os.environ.copy())
        except FileNotFoundError:self.reply(503,{"error":"Hermes CLI was not found on this machine"});return
        except subprocess.TimeoutExpired:self.reply(504,{"error":"Hermes request timed out"});return
        if run.returncode!=0:self.reply(502,{"error":(run.stderr.strip() or "Hermes exited with an error")[:800]});return
        answer=run.stdout.strip()
        if not answer:self.reply(502,{"error":"Hermes returned an empty response"});return
        self.reply(200,{"reply":answer,"provider":"hermes","tools":"disabled"})
    def log_message(self,fmt:str,*args:Any)->None:
        print(f"[neusic-hermes] {fmt%args}")

if __name__=="__main__":
    print(f"Neusic Hermes bridge listening on http://{HOST}:{PORT}")
    print(f"Allowed origins: {', '.join(sorted(ALLOWED))}")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
