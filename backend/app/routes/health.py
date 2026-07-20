from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"ok": True, "service": "neusic-agent-backend", "version": "1.0.0-blite"}
