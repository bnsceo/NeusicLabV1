"""Ollama detection + generation. The DAW never blocks when Ollama is absent."""
import httpx
from ..config import OLLAMA_URL, OLLAMA_DEFAULT_MODEL


async def status() -> dict:
    try:
        async with httpx.AsyncClient(timeout=2.5) as cx:
            r = await cx.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
            models = [m.get("name", "") for m in r.json().get("models", [])]
            default = OLLAMA_DEFAULT_MODEL if OLLAMA_DEFAULT_MODEL in models else (models[0] if models else None)
            return {"available": True, "models": models, "default_model": default, "url": OLLAMA_URL}
    except Exception:
        return {"available": False, "models": [], "default_model": None, "url": OLLAMA_URL}


async def generate(prompt: str, system: str, model: str | None = None) -> str | None:
    st = await status()
    if not st["available"] or not st["default_model"]:
        return None
    try:
        async with httpx.AsyncClient(timeout=60) as cx:
            r = await cx.post(f"{OLLAMA_URL}/api/generate", json={
                "model": model or st["default_model"],
                "system": system,
                "prompt": prompt,
                "stream": False,
            })
            r.raise_for_status()
            return (r.json().get("response") or "").strip() or None
    except Exception:
        return None
