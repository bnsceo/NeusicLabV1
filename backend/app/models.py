"""Request/response contracts for the Neusic Agent bridge (version 3)."""
from typing import Any, Optional
from pydantic import BaseModel, Field


class ChatPreferences(BaseModel):
    verbosity: str = "concise"
    suggestion_frequency: str = "balanced"
    intervention_level: str = "ask-before-changes"


class ChatRequest(BaseModel):
    source: str = "neusic-copilot"
    version: int = 3
    user_id: str
    workspace_id: Optional[str] = None
    project_id: str
    session_id: str
    prompt: str = Field(min_length=1, max_length=4000)
    preferences: ChatPreferences = ChatPreferences()
    context: dict[str, Any] = {}
    recent: list[dict[str, Any]] = []


class MemoryUpdate(BaseModel):
    type: str
    key: str
    value: str
    confidence: float = 1.0


class ProposedAction(BaseModel):
    id: str
    type: str
    requires_approval: bool = True
    summary: str = ""


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    provider: str
    memory_updates: list[MemoryUpdate] = []
    proposed_actions: list[ProposedAction] = []


class MemoryItem(BaseModel):
    memory_type: str
    content: str
    importance: float = 0.5
    confidence: float = 1.0
    agent_name: Optional[str] = None
