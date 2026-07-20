"""Hermes bridge. Order: hosted Hermes -> local Ollama -> built-in advisor.
The built-in advisor keeps the agent useful with zero external services."""
import uuid
import httpx
from ..config import HERMES_API_URL, HERMES_API_KEY
from ..models import ChatRequest, ChatResponse, ProposedAction
from . import ollama_service

SYSTEM = ("You are the Neusic Agent, a producer sitting beside the user inside the "
          "NeusicLab browser DAW. Reply at '{verbosity}' verbosity, plain language, "
          "and never claim to have edited anything — propose actions instead.")


def _advisor(req: ChatRequest) -> str:
    ctx = req.context or {}
    proj = ctx.get("project") or {}
    tracks = ctx.get("tracks") or []
    bits = []
    if proj.get("bpm"):
        bits.append(f"You're at {proj['bpm']} BPM with the {proj.get('kit', 'classic')} kit.")
    muted = [t["name"] for t in tracks if t.get("mute")]
    if muted:
        bits.append(f"Heads up: {', '.join(muted)} is muted.")
    p = req.prompt.lower()
    if any(w in p for w in ("mix", "loud", "level")):
        bits.append("Start the mix with faders: kick and lead vocal first, everything else -6 dB under them, then bring elements up one at a time.")
    elif any(w in p for w in ("arrange", "structure", "bored", "hook")):
        bits.append("Try a contrast move every 8 bars — drop the hats, flip the 808 pattern, or mute the melody for 2 bars before the hook.")
    elif any(w in p for w in ("sound", "sample", "kit")):
        bits.append("Audition kits from the pads panel; Trap for long 808 glides, Boom Bap for punch. Layer a RIM under the snare for snap.")
    else:
        bits.append("Tell me what you're going for — energy, mood, reference track — and I'll give you concrete next moves.")
    return " ".join(bits)


async def chat(req: ChatRequest) -> ChatResponse:
    system = SYSTEM.format(verbosity=req.preferences.verbosity)
    # 1) hosted Hermes
    if HERMES_API_URL:
        try:
            async with httpx.AsyncClient(timeout=45) as cx:
                r = await cx.post(HERMES_API_URL, json=req.model_dump(),
                                  headers={"Authorization": f"Bearer {HERMES_API_KEY}"} if HERMES_API_KEY else {})
                r.raise_for_status()
                data = r.json()
                return ChatResponse(reply=data.get("reply", ""), session_id=req.session_id,
                                    provider="hermes",
                                    memory_updates=data.get("memory_updates", []),
                                    proposed_actions=data.get("proposed_actions", []))
        except Exception:
            pass  # fall through
    # 2) local Ollama
    convo = "\n".join(f"{m.get('role', '?')}: {m.get('content', '')}" for m in req.recent[-8:])
    local = await ollama_service.generate(
        prompt=f"DAW context: {req.context}\n\nRecent:\n{convo}\n\nUser: {req.prompt}",
        system=system)
    if local:
        return ChatResponse(reply=local, session_id=req.session_id, provider="ollama")
    # 3) built-in advisor
    return ChatResponse(
        reply=_advisor(req), session_id=req.session_id, provider="local-advisor",
        proposed_actions=[ProposedAction(id=f"action_{uuid.uuid4().hex[:8]}", type="advice-only",
                                         requires_approval=False, summary="No edits proposed")])
