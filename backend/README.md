# Neusic Agent Backend (AI Agent 1.0 — B-Lite Plus)

FastAPI bridge for the NeusicWave suite: Hermes chat, Ollama detection, and
project memory. Runs locally first; deploys unchanged to Render/Railway/Fly.io.

## Run locally
    cd backend
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env       # optional: add Hermes URL/key
    uvicorn app.main:app --reload --port 8000

Then in the DAW: File → Settings → Provider → Backend URL `http://localhost:8000` → Test connection.

## Provider order
hosted Hermes (if HERMES_API_URL set) → local Ollama (auto-detected) → built-in advisor (always works).

## Endpoints
    GET  /health
    POST /api/hermes/chat
    GET  /api/hermes/health
    GET  /api/providers/ollama/status
    GET  /api/providers/ollama/models
    GET  /api/agents
    GET  /api/memory/projects/{id}?user_id=...
    POST /api/memory/projects/{id}?user_id=...&session_id=...
    DELETE /api/memory/projects/{id}/{memory_id}

## Deferred to Agent 2.0 (September)
Auth, PostgreSQL + pgvector, cloud sync, full CrewAI execution, memory dashboard.
The SQLite schema in `app/services/memory_service.py` is the migration source of truth.
