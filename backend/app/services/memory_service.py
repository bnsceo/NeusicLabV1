"""MemoryService — SQLite-backed, interface-stable for the September cloud version.
Stores structured decisions/preferences only; never raw audio."""
import sqlite3
import uuid
from datetime import datetime, timezone
from ..config import MEMORY_DB_PATH

DDL = """
CREATE TABLE IF NOT EXISTS agent_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  project_id TEXT,
  session_id TEXT,
  agent_name TEXT,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  confidence REAL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_memory_project ON agent_memories(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_memory_session ON agent_memories(session_id);
"""


def _db():
    cx = sqlite3.connect(MEMORY_DB_PATH)
    cx.row_factory = sqlite3.Row
    cx.executescript(DDL)
    return cx


def store(user_id: str, project_id: str, session_id: str, memory_type: str,
          content: str, agent_name: str | None = None,
          importance: float = 0.5, confidence: float = 1.0) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": f"mem_{uuid.uuid4().hex[:12]}", "user_id": user_id, "workspace_id": None,
        "project_id": project_id, "session_id": session_id, "agent_name": agent_name,
        "memory_type": memory_type, "content": content,
        "importance": importance, "confidence": confidence,
        "created_at": now, "updated_at": now, "expires_at": None,
    }
    with _db() as cx:
        cx.execute(
            "INSERT INTO agent_memories (id,user_id,workspace_id,project_id,session_id,"
            "agent_name,memory_type,content,importance,confidence,created_at,updated_at,expires_at)"
            " VALUES (:id,:user_id,:workspace_id,:project_id,:session_id,:agent_name,"
            ":memory_type,:content,:importance,:confidence,:created_at,:updated_at,:expires_at)", row)
    return row


def for_project(user_id: str, project_id: str, limit: int = 20) -> list[dict]:
    with _db() as cx:
        rows = cx.execute(
            "SELECT * FROM agent_memories WHERE user_id=? AND project_id=?"
            " ORDER BY importance DESC, created_at DESC LIMIT ?",
            (user_id, project_id, limit)).fetchall()
    return [dict(r) for r in rows]


def forget(project_id: str, memory_id: str) -> bool:
    with _db() as cx:
        cur = cx.execute("DELETE FROM agent_memories WHERE project_id=? AND id=?", (project_id, memory_id))
    return cur.rowcount > 0
