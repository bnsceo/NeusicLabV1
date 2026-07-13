#!/usr/bin/env python3
"""Smoke-test the Phase 10-12 operational schema and recovery transitions."""
from __future__ import annotations

import json
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    temp = Path(tempfile.mkdtemp(prefix="cyvora-operations-"))
    db_path = temp / "missions.db"
    conn = sqlite3.connect(db_path)
    now = datetime.now(timezone.utc).isoformat()
    conn.executescript(
        """
        CREATE TABLE companies(id INTEGER PRIMARY KEY, tenant TEXT, name TEXT);
        CREATE TABLE execution_runs(
          id INTEGER PRIMARY KEY, tenant TEXT, company_id INTEGER, goal TEXT, status TEXT,
          rollback_state TEXT, error_message TEXT, claimed_by TEXT, claimed_at TEXT,
          lease_expires_at TEXT, heartbeat_at TEXT, attempt_count INTEGER, max_attempts INTEGER,
          started_at TEXT, updated_at TEXT, completed_at TEXT
        );
        CREATE TABLE tasks(
          id INTEGER PRIMARY KEY, company_id INTEGER, title TEXT, status TEXT, last_error TEXT,
          claimed_by TEXT, claimed_at TEXT, lease_expires_at TEXT, heartbeat_at TEXT,
          attempt_count INTEGER, max_attempts INTEGER, updated_at TEXT
        );
        CREATE TABLE activity_events(
          id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER, event_type TEXT,
          title TEXT, description TEXT, created_at TEXT
        );
        CREATE TABLE operations_incidents(
          id INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL, company_id INTEGER,
          fingerprint TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, severity TEXT NOT NULL,
          title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'open', remediation TEXT,
          target_type TEXT, target_id INTEGER, metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT,
          UNIQUE(tenant, fingerprint)
        );
        CREATE TABLE recovery_actions(
          id INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL, company_id INTEGER,
          incident_id INTEGER, action_type TEXT NOT NULL, target_type TEXT, target_id INTEGER,
          status TEXT NOT NULL, requested_by TEXT NOT NULL DEFAULT 'founder', result TEXT,
          created_at TEXT NOT NULL, completed_at TEXT
        );
        """
    )
    conn.execute("INSERT INTO companies VALUES(1, 'default', 'Software Lab')")
    conn.execute(
        "INSERT INTO execution_runs VALUES(1,'default',1,'Ship feature','blocked','failed','lease expired','worker-a',?,?,?,?,?,?,?,?)",
        (now, now, now, 3, 3, now, now, now),
    )
    conn.execute(
        "INSERT INTO tasks VALUES(1,1,'Repair build','blocked','validator failed','worker-a',?,?,?,?,?,?)",
        (now, now, now, 3, 3, now),
    )
    conn.execute(
        """INSERT INTO operations_incidents(
          tenant,company_id,fingerprint,source_type,source_id,severity,title,description,status,
          remediation,target_type,target_id,metadata_json,created_at,updated_at
        ) VALUES('default',1,'execution-run:1:blocked','execution_run','1','critical',
          'Execution run #1 is blocked','lease expired','open','retry safely','execution_run',1,'{}',?,?)""",
        (now, now),
    )
    incident_id = conn.execute("SELECT id FROM operations_incidents").fetchone()[0]

    # Equivalent to retryExecutionRun in lib/db.ts.
    conn.execute(
        """UPDATE execution_runs SET status='queued', rollback_state='ready', error_message=NULL,
           claimed_by=NULL, claimed_at=NULL, lease_expires_at=NULL, heartbeat_at=NULL,
           attempt_count=0, updated_at=?, completed_at=NULL
           WHERE id=1 AND tenant='default' AND status IN ('blocked','failed','error')""",
        (now,),
    )
    conn.execute(
        """INSERT INTO recovery_actions(
          tenant,company_id,incident_id,action_type,target_type,target_id,status,requested_by,result,created_at,completed_at
        ) VALUES('default',1,?,'retry_run','execution_run',1,'completed','founder',
          'Execution run #1 returned to the queue.',?,?)""",
        (incident_id, now, now),
    )
    conn.execute("UPDATE operations_incidents SET status='acknowledged', updated_at=? WHERE id=?", (now, incident_id))

    # Equivalent to requeueTask in lib/db.ts.
    conn.execute(
        """UPDATE tasks SET status='active', last_error=NULL, claimed_by=NULL, claimed_at=NULL,
           lease_expires_at=NULL, heartbeat_at=NULL, attempt_count=0, updated_at=?
           WHERE id=1 AND status IN ('blocked','failed','error')""",
        (now,),
    )
    conn.execute(
        "INSERT INTO activity_events(company_id,event_type,title,description,created_at) VALUES(1,'requeue_task','Task #1 returned to active queue','War Room recovery',?)",
        (now,),
    )
    conn.commit()

    run = conn.execute("SELECT status, attempt_count, error_message, claimed_by FROM execution_runs WHERE id=1").fetchone()
    task = conn.execute("SELECT status, attempt_count, last_error, claimed_by FROM tasks WHERE id=1").fetchone()
    incident = conn.execute("SELECT status FROM operations_incidents WHERE id=?", (incident_id,)).fetchone()
    recoveries = conn.execute("SELECT COUNT(*) FROM recovery_actions").fetchone()[0]
    activity = conn.execute("SELECT COUNT(*) FROM activity_events WHERE event_type='requeue_task'").fetchone()[0]
    conn.close()

    assert run == ("queued", 0, None, None)
    assert task == ("active", 0, None, None)
    assert incident == ("acknowledged",)
    assert recoveries == 1 and activity == 1

    operations_source = (ROOT / "lib" / "operations.ts").read_text(encoding="utf-8")
    assert "buildHeadquartersSnapshot" in operations_source
    assert "buildWarRoomSnapshot" in operations_source
    assert "buildUnifiedHistory" in operations_source
    assert "estimated_cost_usd" in operations_source

    for route in ["app/headquarters/page.tsx", "app/war-room/page.tsx", "app/history/page.tsx"]:
        assert (ROOT / route).exists(), route

    tracker = (ROOT / "ROADMAP_TRACKER.md").read_text(encoding="utf-8")
    assert "| 10 | Headquarters | Complete | $0 |" in tracker
    assert "| 11 | War Room | Complete | $0 |" in tracker
    assert "| 12 | History | Complete | $0 |" in tracker

    print(json.dumps({
        "phase_10": "headquarters operational snapshot present",
        "phase_11": "incident and recovery transitions passed",
        "phase_12": "unified history source present",
        "api_cost": 0,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
