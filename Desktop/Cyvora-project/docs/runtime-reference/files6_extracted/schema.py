"""
Database schema for the autonomous AI holding company.
Phase 0: SQLite. Phase 1+: migrate to Postgres.
"""

import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path("station.db")


def init_db():
    """Create all tables if they don't exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    c = conn.cursor()

    # Companies: the ventures you've approved
    c.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            objective TEXT,
            stage TEXT DEFAULT 'research',  -- research, validated, building, live, scaling, paused, killed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT DEFAULT 'you'
        )
    """)

    # Departments: one per function per company
    c.execute("""
        CREATE TABLE IF NOT EXISTS departments (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            name TEXT NOT NULL,
            lead_agent TEXT NOT NULL,  -- e.g., "Scout", "Ledger", "Forge"
            crew_type TEXT,  -- research, treasury, product, marketing, ux, incident
            status TEXT DEFAULT 'active',
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # Budget: spending per company and cumulative
    c.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            company_id TEXT PRIMARY KEY,
            monthly_ceiling DECIMAL(10,2) NOT NULL,
            spent_this_month DECIMAL(10,2) DEFAULT 0,
            uncommitted DECIMAL(10,2) DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # Decisions: every agent decision, with rationale (audit trail)
    c.execute("""
        CREATE TABLE IF NOT EXISTS decisions_log (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            company_id TEXT,
            agent_role TEXT,  -- "Scout", "Ledger", etc.
            decision TEXT,
            rationale TEXT,
            required_approval INTEGER DEFAULT 0,  -- 1 if awaiting your sign-off
            approved_by TEXT,  -- "you" once you approve
            approved_at TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # Approvals: things waiting on you
    c.execute("""
        CREATE TABLE IF NOT EXISTS approvals (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type TEXT,  -- 'launch_company', 'new_department', 'pricing_change', 'ux_redesign', 'incident_action'
            context_id TEXT,  -- company_id, decision_id, etc.
            prompt TEXT,  -- the actual ask: "Launch supplements ecommerce? Budget: $500"
            status TEXT DEFAULT 'pending',  -- pending, approved, rejected
            decision_made_at TIMESTAMP,
            decision_made_by TEXT
        )
    """)

    # Incidents: war room triggers
    c.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            company_id TEXT,
            severity TEXT,  -- critical, high, medium, low
            title TEXT,
            description TEXT,
            triggered_by TEXT,  -- 'uptime_check', 'error_rate', 'security_alert'
            status TEXT DEFAULT 'open',  -- open, investigating, resolved
            war_room_opened_at TIMESTAMP,
            resolved_at TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # Research results: what the Scout found each week
    c.execute("""
        CREATE TABLE IF NOT EXISTS research_results (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            company_id TEXT,
            sources TEXT,  -- JSON: ['youtube_channel_X', 'tiktok_hashtag_Y', 'gumroad_category_Z']
            findings TEXT,  -- Summary of trends found
            monetization_angles TEXT,  -- JSON: proposals for new ventures
            requires_approval INTEGER DEFAULT 0,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # Operating picture: snapshot of current state (denormalized for fast reads)
    c.execute("""
        CREATE TABLE IF NOT EXISTS operating_picture (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_companies INTEGER,
            active_companies INTEGER,
            pending_approvals INTEGER,
            current_burn_rate DECIMAL(10,2),
            monthly_revenue DECIMAL(10,2),
            hermes_status TEXT,  -- 'idle', 'thinking', 'waiting_on_you'
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def get_db():
    """Get a connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


if __name__ == "__main__":
    init_db()
    print(f"✓ Database initialized at {DB_PATH}")
