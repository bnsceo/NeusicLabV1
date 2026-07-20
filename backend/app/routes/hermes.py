from fastapi import APIRouter
from ..models import ChatRequest, ChatResponse
from ..services import hermes_service

router = APIRouter(prefix="/api/hermes")


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    return await hermes_service.chat(req)


@router.get("/health")
async def hermes_health():
    return {"ok": True, "bridge": "hermes"}
