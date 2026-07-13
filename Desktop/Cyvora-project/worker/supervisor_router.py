#!/usr/bin/env python3
"""
Minimal deterministic worker for Cyvora.

Design goals:
  - claim exactly one approved task
  - resolve exactly one persona
  - call one model or mock
  - validate a strict JSON response
  - commit one result
  - stop on any mismatch

Exit codes:
  0  task executed and committed
  1  no eligible approved task found
  2  persona resolution failed
  3  model call failed
  4  schema validation failed
  5  unexpected/internal error
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


DB_PATH = Path(os.environ.get("MISSIONS_DB_PATH", "/app/data/missions.db"))
PERSONAS_DIR = Path(os.environ.get("AGENCY_AGENTS_DIR", "/app/personas"))
MOCK_MODE = os.environ.get("MOCK_MODE", "true").lower() in {"1", "true", "yes", "on"}
MODEL = os.environ.get("SUPERVISOR_MODEL", "claude-sonnet-5")
MAX_TOKENS = int(os.environ.get("SUPERVISOR_MAX_TOKENS", "1500"))

REQUIRED_FIELDS = {
    "summary": str,
    "deliverable": str,
    "status": str,
    "confidence": (int, float),
    "next_action": (str, type(None)),
}
ALLOWED_STATUS = {"completed", "blocked"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def open_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=10000;")
    return conn


def claim_task(conn: sqlite3.Connection):
    conn.execute("BEGIN IMMEDIATE")
    row = conn.execute(
        """
        SELECT t.id, t.company_id, t.title, t.description, t.assigned_agent, t.workflow_stage
        FROM tasks t
        JOIN approvals a ON a.task_id = t.id
        WHERE t.status = 'active' AND a.status = 'approved'
        ORDER BY t.id ASC
        LIMIT 1
        """
    ).fetchone()

    if row is None:
        conn.execute("ROLLBACK")
        return None

    updated = conn.execute(
        "UPDATE tasks SET status = 'in_progress', updated_at = ? WHERE id = ? AND status = 'active'",
        (now(), row["id"]),
    ).rowcount

    if updated != 1:
        conn.execute("ROLLBACK")
        return None

    conn.execute("COMMIT")
    return dict(row)


def release_task(conn: sqlite3.Connection, task_id: int, status: str) -> None:
    conn.execute(
        "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
        (status, now(), task_id),
    )
    conn.commit()


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")


def resolve_persona(agent_name: str) -> Path:
    if not agent_name:
        raise LookupError("task has no assigned agent")

    target = slugify(agent_name)
    if not PERSONAS_DIR.exists():
        raise LookupError(f"persona directory not found: {PERSONAS_DIR}")

    hits = [path for path in PERSONAS_DIR.rglob("*.md") if path.stem == target]
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        raise LookupError(f"ambiguous persona match for '{agent_name}': {[str(path) for path in hits]}")

    generic = PERSONAS_DIR / "executive-ai.md"
    if generic.exists():
        return generic

    raise LookupError(f"no persona file matches agent '{agent_name}' (slug: {target})")


RESPONSE_CONTRACT = """
Respond with ONLY a single JSON object. No markdown fences, no prose.
The object must have exactly these fields:

{
  "summary": "<= 2 sentences describing what you did>",
  "deliverable": "<the actual work product, in plain text or markdown>",
  "status": "completed" | "blocked",
  "confidence": <number between 0 and 1>,
  "next_action": "<a short follow-up recommendation, or null>"
}

If you cannot complete the task, set "status" to "blocked", explain why in
"summary", and leave "deliverable" as an empty string.
""".strip()


def build_messages(persona_text: str, task: dict):
    system = f"{persona_text}\n\n---\n\n{RESPONSE_CONTRACT}"
    user = (
        f"Task: {task['title']}\n"
        f"Workflow stage: {task['workflow_stage']}\n\n"
        f"Description:\n{task['description'] or '(none provided)'}"
    )
    return system, user


def call_model(system: str, user: str) -> str:
    if MOCK_MODE:
        return json.dumps(
            {
                "summary": "Mock run completed deterministically.",
                "deliverable": "Mock-mode deliverable produced by the local worker loop.",
                "status": "completed",
                "confidence": 0.5,
                "next_action": None,
            }
        )

    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError("anthropic package not installed") from exc

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text_blocks = [block.text for block in response.content if block.type == "text"]
    if not text_blocks:
        raise RuntimeError("model returned no text content")
    return "".join(text_blocks)


def validate_result(raw_text: str) -> dict:
    try:
        obj = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"response is not valid JSON: {exc}")

    if not isinstance(obj, dict):
        raise ValueError("response JSON is not an object")

    for field, expected_type in REQUIRED_FIELDS.items():
        if field not in obj:
            raise ValueError(f"missing required field: {field}")
        if not isinstance(obj[field], expected_type):
            raise ValueError(f"field '{field}' has wrong type: {type(obj[field]).__name__}")

    if obj["status"] not in ALLOWED_STATUS:
        raise ValueError(f"field 'status' must be one of {sorted(ALLOWED_STATUS)}")

    if not 0 <= float(obj["confidence"]) <= 1:
        raise ValueError(f"field 'confidence' must be between 0 and 1, got {obj['confidence']}")

    return obj


def upsert_output(conn: sqlite3.Connection, task: dict, result: dict) -> None:
    title = f"{task['title']} result"
    summary = f"{result['summary']}\n\n{result['deliverable']}".strip()
    existing = conn.execute("SELECT id FROM outputs WHERE task_id = ? LIMIT 1", (task["id"],)).fetchone()
    if existing:
        conn.execute(
            "UPDATE outputs SET status = ?, summary = ? WHERE id = ?",
            ("final" if result["status"] == "completed" else "blocked", summary, existing["id"]),
        )
        return

    conn.execute(
        """
        INSERT INTO outputs (company_id, task_id, title, output_type, status, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            task["company_id"],
            task["id"],
            title,
            "result",
            "final" if result["status"] == "completed" else "blocked",
            summary,
            now(),
        ),
    )


def record_event(conn: sqlite3.Connection, task: dict | None, event_type: str, title: str, description: str) -> None:
    conn.execute(
        """
        INSERT INTO activity_events (company_id, event_type, title, description, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (task["company_id"] if task else None, event_type, title, description, now()),
    )


def main() -> int:
    conn = open_connection()
    task = None
    try:
        task = claim_task(conn)
        if task is None:
            print("No eligible approved task found. Nothing to do.")
            return 1

        print(f"Claimed task #{task['id']}: {task['title']}")

        try:
            persona_path = resolve_persona(task["assigned_agent"])
        except LookupError as exc:
            print(f"BLOCKED — persona resolution failed: {exc}", file=sys.stderr)
            release_task(conn, task["id"], "blocked")
            record_event(conn, task, "task_execution_blocked", f"Task #{task['id']} blocked", str(exc))
            conn.commit()
            return 2

        persona_text = persona_path.read_text(encoding="utf-8")
        system, user = build_messages(persona_text, task)

        try:
            raw_response = call_model(system, user)
        except Exception as exc:
            print(f"BLOCKED — model call failed: {exc}", file=sys.stderr)
            release_task(conn, task["id"], "blocked")
            record_event(conn, task, "task_execution_blocked", f"Task #{task['id']} blocked", f"model call failed: {exc}")
            conn.commit()
            return 3

        try:
            result = validate_result(raw_response)
        except ValueError as exc:
            print(f"BLOCKED — schema validation failed: {exc}", file=sys.stderr)
            print(f"Raw response was:\n{raw_response}", file=sys.stderr)
            release_task(conn, task["id"], "blocked")
            record_event(conn, task, "task_execution_blocked", f"Task #{task['id']} blocked", f"schema validation failed: {exc}")
            conn.commit()
            return 4

        conn.execute("BEGIN IMMEDIATE")
        upsert_output(conn, task, result)
        conn.execute(
            "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
            ("completed" if result["status"] == "completed" else "blocked", now(), task["id"]),
        )
        record_event(
            conn,
            task,
            "task_executed",
            f"Task #{task['id']} {result['status']}",
            result["summary"],
        )
        conn.commit()

        print(f"Task #{task['id']} committed with status '{result['status']}'.")
        return 0

    except Exception as exc:  # noqa: BLE001
        print(f"BLOCKED — unexpected error: {exc}", file=sys.stderr)
        if task is not None:
            release_task(conn, task["id"], "blocked")
            record_event(conn, task, "task_execution_blocked", f"Task #{task['id']} blocked", f"unexpected error: {exc}")
            conn.commit()
        return 5
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
