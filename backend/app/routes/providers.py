from fastapi import APIRouter
from ..services import ollama_service
from ..agents.registry import list_agents

router = APIRouter(prefix="/api")


@router.get("/providers/ollama/status")
async def ollama_status():
    return await ollama_service.status()


@router.get("/providers/ollama/models")
async def ollama_models():
    st = await ollama_service.status()
    return {"models": st["models"], "default_model": st["default_model"]}


@router.get("/agents")
async def agents():
    return {"agents": list_agents()}
