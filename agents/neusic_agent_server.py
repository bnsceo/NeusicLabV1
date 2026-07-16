from __future__ import annotations

import json
import os
import shlex
import subprocess
from typing import Any, Literal
from urllib import request as urllib_request

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Neusic Agent Bridge", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("NEUSIC_AGENT_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000,https://bnsceo.github.io").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class AgentRequest(BaseModel):
    provider: Literal["hermes", "crewai", "guide"] = "guide"
    message: str = Field(min_length=1, max_length=8000)
    context: dict[str, Any] = Field(default_factory=dict)


class AgentResponse(BaseModel):
    provider: str
    reply: str


def system_prompt(context: dict[str, Any]) -> str:
    return (
        "You are Neusic Agent, a concise music-production assistant embedded in the Neusic suite. "
        "Neusic Live Loop captures synchronized performance lanes, Neusic Wave refines and transforms sound, "
        "and Neusic Lab arranges, records, mixes, masters, and exports. Preserve user work, never claim an action "
        "was performed unless the supplied context proves it, and give concrete next steps.\n\n"
        f"Current application context:\n{json.dumps(context, ensure_ascii=False, indent=2)}"
    )


def guide_reply(message: str, context: dict[str, Any]) -> str:
    product = context.get("product", "home")
    lowered = message.lower()
    if "record" in lowered or "microphone" in lowered or "mic" in lowered:
        if product == "live-loop":
            return "Select a lane, enable the microphone, tap REC, perform, then tap REC again to close the first loop. MIDI is optional; later lanes synchronize to the first loop automatically."
        if product == "wave":
            return "Open Capture, arm NeuCapture or Record Full Sample, then move the recording into The Forge for trimming, slicing, mapping, and playback."
        return "Open Capture, create or select an audio track, arm it, confirm the input device, and use the main transport Record control."
    if "transfer" in lowered or "forge" in lowered:
        return "Use Live Loop’s FORGE action to move a recorded lane into Neusic Wave. From Wave, use Send to Lab to create a real audio track in the Studio project."
    if "mix" in lowered or "master" in lowered or "export" in lowered:
        return "Use Neusic Lab’s Mix workspace for balance and routing, then Deliver for master checks, stems, project packaging, and the final WAV."
    return "Recommended path: capture in Live Loop, refine in Wave, and finish in Lab. You can also start in any product and transfer forward when useful."


def hermes_reply(message: str, context: dict[str, Any]) -> str:
    prompt = f"{system_prompt(context)}\n\nUser request:\n{message}"
    endpoint = os.getenv("HERMES_AGENT_URL", "").strip()
    if endpoint:
        payload = json.dumps({"message": prompt, "context": context}).encode("utf-8")
        req = urllib_request.Request(endpoint, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib_request.urlopen(req, timeout=float(os.getenv("HERMES_TIMEOUT", "90"))) as response:
                data = json.loads(response.read().decode("utf-8"))
        except Exception as exc:  # pragma: no cover - depends on local gateway
            raise HTTPException(status_code=502, detail=f"Hermes endpoint failed: {exc}") from exc
        return str(data.get("reply") or data.get("result") or data.get("message") or data)

    command_template = os.getenv("HERMES_COMMAND", "").strip()
    if command_template:
        command = [part.replace("{prompt}", prompt) for part in shlex.split(command_template)]
        try:
            completed = subprocess.run(command, capture_output=True, text=True, timeout=float(os.getenv("HERMES_TIMEOUT", "90")), check=True)
        except Exception as exc:  # pragma: no cover - depends on local CLI
            raise HTTPException(status_code=502, detail=f"Hermes command failed: {exc}") from exc
        return completed.stdout.strip() or completed.stderr.strip() or "Hermes completed without text output."

    raise HTTPException(status_code=503, detail="Configure HERMES_AGENT_URL or HERMES_COMMAND before selecting Hermes.")


def crewai_reply(message: str, context: dict[str, Any]) -> str:
    try:
        from crewai import Agent, Crew, Process, Task
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise HTTPException(status_code=503, detail="CrewAI is not installed. Run: pip install -r agents/requirements.txt") from exc

    creative = Agent(
        role="Neusic Creative Director",
        goal="Turn the creator's intention into a focused musical next step.",
        backstory="You understand the connected Live Loop, Wave, and Lab workflow and protect creative momentum.",
        verbose=False,
    )
    engineer = Agent(
        role="Neusic Audio Engineer",
        goal="Identify the safest technical workflow for recording, editing, routing, synchronization, and export.",
        backstory="You are rigorous about browser audio limits, gain staging, mobile interaction, and preserving project state.",
        verbose=False,
    )
    producer = Agent(
        role="Neusic Producer",
        goal="Combine creative and technical guidance into a short actionable answer.",
        backstory="You make decisions quickly and explain the exact sequence the creator should follow.",
        verbose=False,
    )
    context_json = json.dumps(context, ensure_ascii=False, indent=2)
    creative_task = Task(
        description="Interpret this request in musical terms and recommend the strongest creative direction. Request: {message}. Context: {context}",
        expected_output="A concise creative recommendation with no invented actions.",
        agent=creative,
    )
    engineering_task = Task(
        description="Audit the request for recording, synchronization, mobile, routing, transfer, or export constraints. Request: {message}. Context: {context}",
        expected_output="A concise technical recommendation and any important constraint.",
        agent=engineer,
    )
    final_task = Task(
        description="Combine the prior recommendations into one direct Neusic answer with numbered next actions. Request: {message}.",
        expected_output="A short, practical response suitable for the in-app Neusic Agent panel.",
        agent=producer,
        context=[creative_task, engineering_task],
    )
    crew = Crew(agents=[creative, engineer, producer], tasks=[creative_task, engineering_task, final_task], process=Process.sequential, verbose=False)
    result = crew.kickoff(inputs={"message": message, "context": context_json})
    return str(getattr(result, "raw", result))


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "providers": ["guide", "hermes", "crewai"]}


@app.post("/api/neusic-agent", response_model=AgentResponse)
def agent(payload: AgentRequest) -> AgentResponse:
    if payload.provider == "hermes":
        reply = hermes_reply(payload.message, payload.context)
    elif payload.provider == "crewai":
        reply = crewai_reply(payload.message, payload.context)
    else:
        reply = guide_reply(payload.message, payload.context)
    return AgentResponse(provider=payload.provider, reply=reply)
