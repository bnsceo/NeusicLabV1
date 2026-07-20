from fastapi import APIRouter, HTTPException
from ..models import MemoryItem
from ..services import memory_service

router = APIRouter(prefix="/api/memory")


@router.get("/projects/{project_id}")
async def get_project_memory(project_id: str, user_id: str, limit: int = 20):
    return {"memories": memory_service.for_project(user_id, project_id, limit)}


@router.post("/projects/{project_id}")
async def store_project_memory(project_id: str, user_id: str, session_id: str, item: MemoryItem):
    row = memory_service.store(
        user_id=user_id, project_id=project_id, session_id=session_id,
        memory_type=item.memory_type, content=item.content,
        agent_name=item.agent_name, importance=item.importance, confidence=item.confidence)
    return {"stored": True, "id": row["id"]}


@router.delete("/projects/{project_id}/{memory_id}")
async def delete_project_memory(project_id: str, memory_id: str):
    if not memory_service.forget(project_id, memory_id):
        raise HTTPException(404, "memory not found")
    return {"deleted": True}
