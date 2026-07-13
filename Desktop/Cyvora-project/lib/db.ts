import type { Database, RunResult } from 'sqlite3';
import { createRequire } from 'node:module';
import path from 'path';
import fs from 'fs';
import { workspaceRoot } from './paths';

const DB_PATH = path.join(/*turbopackIgnore: true*/ workspaceRoot, 'data', 'missions.db');
const SKIP_DB_INIT = process.env.CYVORA_SKIP_DB_INIT === '1';

function createBuildDatabaseStub(): Database {
  const stub: any = {};
  const invoke = (args: any[], value?: unknown) => {
    const callback = args.findLast((item) => typeof item === 'function');
    if (callback) queueMicrotask(() => callback(null, value));
  };
  stub.run = (...args: any[]) => { invoke(args); return stub; };
  stub.all = (...args: any[]) => { invoke(args, []); return stub; };
  stub.get = (...args: any[]) => { invoke(args, undefined); return stub; };
  stub.prepare = () => ({
    run: (...args: any[]) => { invoke(args); return stub; },
    finalize: (callback?: (error?: Error | null) => void) => { if (callback) queueMicrotask(() => callback(null)); },
  });
  stub.close = (callback?: (error?: Error | null) => void) => { if (callback) queueMicrotask(() => callback(null)); };
  return stub as Database;
}

if (!SKIP_DB_INIT) {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

const sqlitePackageName = ['sqlite', '3'].join('');
const sqliteModule = SKIP_DB_INIT ? null : (createRequire(import.meta.url)(sqlitePackageName) as { Database: new (filename: string) => Database });
const db: Database = SKIP_DB_INIT ? createBuildDatabaseStub() : new sqliteModule!.Database(DB_PATH);

// --- Missions table (existing) ---
db.run(`
  CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objective TEXT NOT NULL,
    agents TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    briefing_file TEXT
  )
`);

// --- Companies table ---
db.run(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    brand_color TEXT,
    created_at TEXT NOT NULL,
    status TEXT DEFAULT 'active'
  )
`);

// --- Departments table ---
db.run(`
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  )
`);

// --- Teams table ---
db.run(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(department_id) REFERENCES departments(id)
  )
`);

// --- Agent Assignments table ---
db.run(`
  CREATE TABLE IF NOT EXISTS agent_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    task_type TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id)
  )
`);

// --- Connector table ---
db.run(`
  CREATE TABLE IF NOT EXISTS connectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    department_id INTEGER,
    team_id INTEGER,
    name TEXT NOT NULL,
    connector_type TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id),
    FOREIGN KEY(department_id) REFERENCES departments(id),
    FOREIGN KEY(team_id) REFERENCES teams(id)
  )
`);

// --- Harness Engineering Requests table ---
db.run(`
  CREATE TABLE IF NOT EXISTS self_coding_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    request TEXT NOT NULL,
    status TEXT NOT NULL,
    stage TEXT NOT NULL,
    approval_state TEXT NOT NULL,
    assigned_agents TEXT NOT NULL,
    qa_confidence INTEGER NOT NULL,
    qa_summary TEXT,
    dissent TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// --- Operating layer tables ---
db.run(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    department_id INTEGER,
    team_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    workflow_stage TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    assigned_agent TEXT,
    risk_level TEXT NOT NULL DEFAULT 'medium',
    validation_policy TEXT NOT NULL DEFAULT 'schema',
    revision_count INTEGER NOT NULL DEFAULT 0,
    max_revisions INTEGER NOT NULL DEFAULT 2,
    claimed_by TEXT,
    claimed_at TEXT,
    lease_expires_at TEXT,
    heartbeat_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id),
    FOREIGN KEY(department_id) REFERENCES departments(id),
    FOREIGN KEY(team_id) REFERENCES teams(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    task_id INTEGER,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    approval_type TEXT NOT NULL DEFAULT 'task_execution',
    subject_type TEXT,
    subject_id INTEGER,
    execution_run_id INTEGER,
    decision_reason TEXT,
    decided_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id),
    FOREIGN KEY(task_id) REFERENCES tasks(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    task_id INTEGER,
    title TEXT NOT NULL,
    output_type TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT,
    execution_run_id INTEGER,
    candidate_version INTEGER NOT NULL DEFAULT 1,
    agent_confidence REAL,
    review_status TEXT NOT NULL DEFAULT 'unreviewed',
    finalized_at TEXT,
    approved_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id),
    FOREIGN KEY(task_id) REFERENCES tasks(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS execution_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    request_id INTEGER NOT NULL,
    mission_id INTEGER,
    company_id INTEGER,
    goal TEXT NOT NULL,
    runtime_plan TEXT NOT NULL,
    runtime_mode TEXT NOT NULL,
    status TEXT NOT NULL,
    rollback_state TEXT NOT NULL,
    paid_ai INTEGER NOT NULL,
    mock_mode INTEGER NOT NULL,
    error_message TEXT,
    claimed_by TEXT,
    claimed_at TEXT,
    lease_expires_at TEXT,
    heartbeat_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY(request_id) REFERENCES self_coding_requests(id),
    FOREIGN KEY(mission_id) REFERENCES missions(id),
    FOREIGN KEY(company_id) REFERENCES companies(id)
  )
`);



db.run(`
  CREATE TABLE IF NOT EXISTS validation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    output_id INTEGER NOT NULL,
    execution_run_id INTEGER,
    validator_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    protocol TEXT NOT NULL,
    status TEXT NOT NULL,
    confidence REAL,
    decision TEXT,
    findings_json TEXT NOT NULL DEFAULT '[]',
    blocking_findings_json TEXT NOT NULL DEFAULT '[]',
    dissent_json TEXT NOT NULL DEFAULT '[]',
    requires_human_approval INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd REAL NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY(company_id) REFERENCES companies(id),
    FOREIGN KEY(task_id) REFERENCES tasks(id),
    FOREIGN KEY(output_id) REFERENCES outputs(id),
    FOREIGN KEY(execution_run_id) REFERENCES execution_runs(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    company_id INTEGER,
    task_id INTEGER,
    execution_run_id INTEGER,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd REAL NOT NULL DEFAULT 0,
    provider_request_id TEXT,
    created_at TEXT NOT NULL
  )
`);


db.run(`
  CREATE TABLE IF NOT EXISTS connector_installations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    company_id INTEGER,
    connector_id TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'mock',
    status TEXT NOT NULL DEFAULT 'enabled',
    enabled INTEGER NOT NULL DEFAULT 1,
    config_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant, company_id, connector_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS connector_action_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    company_id INTEGER,
    task_id INTEGER,
    connector_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    policy_effect TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    side_effect TEXT NOT NULL,
    reversible INTEGER NOT NULL DEFAULT 1,
    idempotency_key TEXT,
    external_reference TEXT,
    payload_json TEXT NOT NULL DEFAULT '{}',
    result_json TEXT NOT NULL DEFAULT '{}',
    requested_by TEXT NOT NULL DEFAULT 'agent',
    created_at TEXT NOT NULL,
    completed_at TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS policy_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    company_id INTEGER,
    task_id INTEGER,
    connector_action_run_id INTEGER,
    policy_pack TEXT NOT NULL,
    effect TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    side_effect TEXT NOT NULL,
    reason TEXT NOT NULL,
    matched_rules_json TEXT NOT NULL DEFAULT '[]',
    input_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(connector_action_run_id) REFERENCES connector_action_runs(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS worker_heartbeats (
    worker_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    current_run_id INTEGER,
    current_task_id INTEGER,
    hostname TEXT,
    process_id INTEGER,
    version TEXT,
    started_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    details TEXT
  )
`);


db.run(`
  CREATE TABLE IF NOT EXISTS operations_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    company_id INTEGER,
    fingerprint TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    remediation TEXT,
    target_type TEXT,
    target_id INTEGER,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    UNIQUE(tenant, fingerprint),
    FOREIGN KEY(company_id) REFERENCES companies(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS recovery_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    company_id INTEGER,
    incident_id INTEGER,
    action_type TEXT NOT NULL,
    target_type TEXT,
    target_id INTEGER,
    status TEXT NOT NULL,
    requested_by TEXT NOT NULL DEFAULT 'founder',
    result TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY(company_id) REFERENCES companies(id),
    FOREIGN KEY(incident_id) REFERENCES operations_incidents(id)
  )
`);


db.run(`CREATE INDEX IF NOT EXISTS idx_operations_incidents_tenant_status ON operations_incidents(tenant, status, severity, updated_at)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_recovery_actions_tenant_created ON recovery_actions(tenant, created_at)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_activity_events_company_created ON activity_events(company_id, created_at)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_execution_runs_tenant_status ON execution_runs(tenant, status, updated_at)`);

function ensureColumn(table: string, column: string, definition: string): void {
  db.all(`PRAGMA table_info(${table})`, (err, rows: any[]) => {
    if (err) {
      console.error(`[db] unable to inspect ${table}.${column}:`, err);
      return;
    }
    if (rows.some((row) => row.name === column)) return;
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr) console.error(`[db] unable to add ${table}.${column}:`, alterErr);
    });
  });
}

[
  ['tasks', 'claimed_by', 'TEXT'],
  ['tasks', 'claimed_at', 'TEXT'],
  ['tasks', 'lease_expires_at', 'TEXT'],
  ['tasks', 'heartbeat_at', 'TEXT'],
  ['tasks', 'attempt_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['tasks', 'max_attempts', 'INTEGER NOT NULL DEFAULT 3'],
  ['tasks', 'last_error', 'TEXT'],
  ['tasks', 'risk_level', "TEXT NOT NULL DEFAULT 'medium'"],
  ['tasks', 'validation_policy', "TEXT NOT NULL DEFAULT 'schema'"],
  ['tasks', 'revision_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['tasks', 'max_revisions', 'INTEGER NOT NULL DEFAULT 2'],
  ['approvals', 'approval_type', "TEXT NOT NULL DEFAULT 'task_execution'"],
  ['approvals', 'subject_type', 'TEXT'],
  ['approvals', 'subject_id', 'INTEGER'],
  ['approvals', 'execution_run_id', 'INTEGER'],
  ['approvals', 'decision_reason', 'TEXT'],
  ['approvals', 'decided_at', 'TEXT'],
  ['outputs', 'execution_run_id', 'INTEGER'],
  ['outputs', 'candidate_version', 'INTEGER NOT NULL DEFAULT 1'],
  ['outputs', 'agent_confidence', 'REAL'],
  ['outputs', 'review_status', "TEXT NOT NULL DEFAULT 'unreviewed'"],
  ['outputs', 'finalized_at', 'TEXT'],
  ['outputs', 'approved_at', 'TEXT'],
  ['execution_runs', 'claimed_by', 'TEXT'],
  ['execution_runs', 'claimed_at', 'TEXT'],
  ['execution_runs', 'lease_expires_at', 'TEXT'],
  ['execution_runs', 'heartbeat_at', 'TEXT'],
  ['execution_runs', 'attempt_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['execution_runs', 'max_attempts', 'INTEGER NOT NULL DEFAULT 3'],
].forEach(([table, column, definition]) => ensureColumn(table, column, definition));

// --- Mission functions ---
export function saveMission(data: {
  objective: string;
  agents: any[];
  status: string;
  timestamp: string;
  briefing_file?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO missions (objective, agents, status, timestamp, briefing_file)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.objective,
      JSON.stringify(data.agents),
      data.status,
      data.timestamp,
      data.briefing_file || null,
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getAllMissions(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM missions ORDER BY timestamp DESC`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function getMission(id: number): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM missions WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function searchMissions(query: string, status?: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM missions WHERE objective LIKE ?`;
    const params = [`%${query}%`];
    if (status && status !== 'all') {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY timestamp DESC`;
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function updateMissionStatus(id: number, status: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE missions SET status = ? WHERE id = ?`, [status, id], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

// --- Company functions ---
export function saveCompany(data: {
  tenant: string;
  name: string;
  description?: string;
  brand_color?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO companies (tenant, name, description, brand_color, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.tenant,
      data.name,
      data.description || '',
      data.brand_color || '#6366f1',
      new Date().toISOString(),
      'active',
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getCompanies(tenant: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM companies WHERE tenant = ? ORDER BY created_at DESC`, [tenant], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function getCompany(id: number): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM companies WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// --- Department functions ---
export function saveDepartment(data: {
  company_id: number;
  name: string;
  description?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO departments (company_id, name, description, created_at)
       VALUES (?, ?, ?, ?)`
    );
    stmt.run(
      data.company_id,
      data.name,
      data.description || '',
      new Date().toISOString(),
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getDepartments(company_id: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM departments WHERE company_id = ? ORDER BY created_at ASC`, [company_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --- Team functions ---
export function saveTeam(data: {
  department_id: number;
  name: string;
  description?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO teams (department_id, name, description, created_at)
       VALUES (?, ?, ?, ?)`
    );
    stmt.run(
      data.department_id,
      data.name,
      data.description || '',
      new Date().toISOString(),
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getTeams(department_id: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM teams WHERE department_id = ? ORDER BY created_at ASC`, [department_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --- Agent Assignment functions ---
export function saveAgentAssignment(data: {
  team_id: number;
  agent_name: string;
  task_type?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO agent_assignments (team_id, agent_name, task_type, created_at)
       VALUES (?, ?, ?, ?)`
    );
    stmt.run(
      data.team_id,
      data.agent_name,
      data.task_type || '',
      new Date().toISOString(),
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getAgentAssignments(team_id: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM agent_assignments WHERE team_id = ? ORDER BY created_at ASC`, [team_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --- Harness Engineering Request functions ---
export function saveSelfCodingRequest(data: {
  tenant: string;
  request: string;
  status: string;
  stage: string;
  approval_state: string;
  assigned_agents: any[];
  qa_confidence: number;
  qa_summary?: string;
  dissent?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO self_coding_requests (
        tenant, request, status, stage, approval_state, assigned_agents,
        qa_confidence, qa_summary, dissent, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.tenant,
      data.request,
      data.status,
      data.stage,
      data.approval_state,
      JSON.stringify(data.assigned_agents),
      data.qa_confidence,
      data.qa_summary || '',
      data.dissent || '',
      now,
      now,
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getSelfCodingRequests(tenant: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM self_coding_requests WHERE tenant = ? ORDER BY created_at DESC`,
      [tenant],
      (err, rows) => {
        if (err) reject(err);
        else {
          resolve(rows.map((row: any) => ({
            ...row,
            assigned_agents: JSON.parse(row.assigned_agents || '[]'),
          })));
        }
      }
    );
  });
}

export function updateSelfCodingApproval(data: {
  id: number;
  tenant: string;
  approval_state: string;
  status: string;
  stage: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE self_coding_requests
       SET approval_state = ?, status = ?, stage = ?, updated_at = ?
       WHERE id = ? AND tenant = ?`,
      [
        data.approval_state,
        data.status,
        data.stage,
        new Date().toISOString(),
        data.id,
        data.tenant,
      ],
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// --- Operating layer functions ---
export function saveTask(data: {
  company_id: number;
  department_id?: number;
  team_id?: number;
  title: string;
  description?: string;
  workflow_stage: string;
  status: string;
  priority: string;
  assigned_agent?: string;
  risk_level?: string;
  validation_policy?: string;
  max_revisions?: number;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO tasks (
        company_id, department_id, team_id, title, description, workflow_stage,
        status, priority, assigned_agent, risk_level, validation_policy, max_revisions, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.company_id,
      data.department_id || null,
      data.team_id || null,
      data.title,
      data.description || '',
      data.workflow_stage,
      data.status,
      data.priority,
      data.assigned_agent || '',
      data.risk_level || 'medium',
      data.validation_policy || 'schema',
      data.max_revisions || 2,
      now,
      now,
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getTasks(company_id: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM tasks WHERE company_id = ? ORDER BY created_at DESC`, [company_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function saveConnector(data: {
  company_id: number;
  department_id?: number;
  team_id?: number;
  name: string;
  connector_type: string;
  status: string;
  summary?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO connectors (
        company_id, department_id, team_id, name, connector_type, status, summary, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.company_id,
      data.department_id || null,
      data.team_id || null,
      data.name,
      data.connector_type,
      data.status,
      data.summary || '',
      now,
      now,
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getConnectors(company_id: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM connectors WHERE company_id = ? ORDER BY created_at DESC`, [company_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function saveApproval(data: {
  company_id: number;
  task_id?: number;
  title: string;
  summary?: string;
  status: string;
  risk_level: string;
  approval_type?: string;
  subject_type?: string;
  subject_id?: number;
  execution_run_id?: number;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO approvals (company_id, task_id, title, summary, status, risk_level, approval_type, subject_type, subject_id, execution_run_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.company_id,
      data.task_id || null,
      data.title,
      data.summary || '',
      data.status,
      data.risk_level,
      data.approval_type || 'task_execution',
      data.subject_type || null,
      data.subject_id || null,
      data.execution_run_id || null,
      now,
      now,
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getApprovals(company_id: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM approvals WHERE company_id = ? ORDER BY created_at DESC`, [company_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function getApprovalById(id: number, tenant: string): Promise<any | null> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT a.* FROM approvals a JOIN companies c ON c.id = a.company_id WHERE a.id = ? AND c.tenant = ? LIMIT 1`,
      [id, tenant],
      (err, row) => { if (err) reject(err); else resolve(row || null); }
    );
  });
}

export function updateApprovalStatus(data: {
  id: number;
  company_id: number;
  status: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE approvals
       SET status = ?, decided_at = ?, updated_at = ?
       WHERE id = ? AND company_id = ?`,
      [data.status, new Date().toISOString(), new Date().toISOString(), data.id, data.company_id],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

export function saveOutput(data: {
  company_id: number;
  task_id?: number;
  title: string;
  output_type: string;
  status: string;
  summary?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO outputs (company_id, task_id, title, output_type, status, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.company_id,
      data.task_id || null,
      data.title,
      data.output_type,
      data.status,
      data.summary || '',
      new Date().toISOString(),
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getOutputs(company_id: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM outputs WHERE company_id = ? ORDER BY created_at DESC`, [company_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function saveActivityEvent(data: {
  company_id?: number;
  event_type: string;
  title: string;
  description?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO activity_events (company_id, event_type, title, description, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.company_id || null,
      data.event_type,
      data.title,
      data.description || '',
      new Date().toISOString(),
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getActivityEvents(company_id?: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    if (company_id) {
      db.all(`SELECT * FROM activity_events WHERE company_id = ? ORDER BY created_at DESC LIMIT 20`, [company_id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
      return;
    }
    db.all(`SELECT * FROM activity_events ORDER BY created_at DESC LIMIT 30`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function saveExecutionRun(data: {
  tenant: string;
  request_id: number;
  goal: string;
  runtime_plan: any;
  runtime_mode: string;
  status: string;
  rollback_state: string;
  paid_ai: boolean;
  mock_mode: boolean;
  mission_id?: number;
  company_id?: number;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO execution_runs (
        tenant, request_id, mission_id, company_id, goal, runtime_plan, runtime_mode,
        status, rollback_state, paid_ai, mock_mode, started_at, updated_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.tenant,
      data.request_id,
      data.mission_id || null,
      data.company_id || null,
      data.goal,
      JSON.stringify(data.runtime_plan),
      data.runtime_mode,
      data.status,
      data.rollback_state,
      data.paid_ai ? 1 : 0,
      data.mock_mode ? 1 : 0,
      now,
      now,
      null,
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function updateExecutionRun(data: {
  id: number;
  status: string;
  rollback_state?: string;
  error_message?: string;
  mission_id?: number;
  company_id?: number;
  completed?: boolean;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE execution_runs
       SET status = ?,
           rollback_state = COALESCE(?, rollback_state),
           error_message = COALESCE(?, error_message),
           mission_id = COALESCE(?, mission_id),
           company_id = COALESCE(?, company_id),
           completed_at = COALESCE(?, completed_at),
           updated_at = ?
       WHERE id = ?`,
      [
        data.status,
        data.rollback_state || null,
        data.error_message || null,
        data.mission_id || null,
        data.company_id || null,
        data.completed ? now : null,
        now,
        data.id,
      ],
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

export function getExecutionRuns(tenant?: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const sql = tenant
      ? `SELECT * FROM execution_runs WHERE tenant = ? ORDER BY started_at DESC LIMIT 20`
      : `SELECT * FROM execution_runs ORDER BY started_at DESC LIMIT 20`;
    const params = tenant ? [tenant] : [];
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else {
        resolve(
          rows.map((row: any) => ({
            ...row,
            runtime_plan: JSON.parse(row.runtime_plan || '{}'),
            paid_ai: row.paid_ai === 1,
            mock_mode: row.mock_mode === 1,
          }))
        );
      }
    });
  });
}

export function getExecutionRunById(id: number, tenant?: string): Promise<any | null> {
  return new Promise((resolve, reject) => {
    const sql = tenant
      ? `SELECT * FROM execution_runs WHERE id = ? AND tenant = ? LIMIT 1`
      : `SELECT * FROM execution_runs WHERE id = ? LIMIT 1`;
    const params = tenant ? [id, tenant] : [id];
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        resolve(null);
        return;
      }
      resolve({
        ...row,
        runtime_plan: JSON.parse((row as any).runtime_plan || '{}'),
        paid_ai: (row as any).paid_ai === 1,
        mock_mode: (row as any).mock_mode === 1,
      });
    });
  });
}

async function runDelete(sql: string, params: unknown[] = []): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

export async function clearDemoTenantData(tenant: string): Promise<void> {
  await runDelete(`DELETE FROM recovery_actions WHERE tenant = ?`, [tenant]);
  await runDelete(`DELETE FROM operations_incidents WHERE tenant = ?`, [tenant]);
  const companies = await getCompanies(tenant);
  for (const company of companies) {
    await runDelete(`DELETE FROM activity_events WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM outputs WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM approvals WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM tasks WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM connectors WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM connector_action_runs WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM policy_decisions WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM connector_installations WHERE company_id = ?`, [company.id]);

    const departments = await getDepartments(company.id);
    for (const department of departments) {
      const teams = await getTeams(department.id);
      for (const team of teams) {
        await runDelete(`DELETE FROM agent_assignments WHERE team_id = ?`, [team.id]);
      }
      await runDelete(`DELETE FROM teams WHERE department_id = ?`, [department.id]);
    }

    await runDelete(`DELETE FROM departments WHERE company_id = ?`, [company.id]);
  }

  await runDelete(`DELETE FROM companies WHERE tenant = ?`, [tenant]);
  await runDelete(`DELETE FROM self_coding_requests WHERE tenant = ?`, [tenant]);
  await runDelete(`DELETE FROM execution_runs WHERE tenant = ?`, [tenant]);
}

export function clearDemoMissions(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM missions WHERE objective LIKE '[DEMO] %'`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}


export function finalizeApprovedResult(data: { approval_id: number; company_id: number; task_id?: number; output_id?: number; execution_run_id?: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE');
      if (data.output_id) db.run(`UPDATE outputs SET status = 'final', review_status = 'approved', approved_at = ?, finalized_at = ? WHERE id = ? AND company_id = ?`, [timestamp, timestamp, data.output_id, data.company_id]);
      if (data.task_id) db.run(`UPDATE tasks SET status = 'completed', updated_at = ? WHERE id = ? AND company_id = ?`, [timestamp, data.task_id, data.company_id]);
      if (data.execution_run_id) db.run(`UPDATE execution_runs SET status = 'completed', rollback_state = 'complete', completed_at = ?, updated_at = ? WHERE id = ? AND company_id = ?`, [timestamp, timestamp, data.execution_run_id, data.company_id]);
      db.run(`INSERT INTO activity_events (company_id, event_type, title, description, created_at) VALUES (?, 'result_approved', ?, ?, ?)`, [data.company_id, `Result approval #${data.approval_id} completed`, 'Candidate output was accepted and finalized by the founder approval flow.', timestamp], (err) => {
        if (err) { db.run('ROLLBACK'); reject(err); return; }
        db.run('COMMIT', (commitErr) => commitErr ? reject(commitErr) : resolve());
      });
    });
  });
}


// --- Connector framework and policy engine functions ---
export function upsertConnectorInstallation(data: {
  tenant: string;
  company_id?: number;
  connector_id: string;
  mode?: 'mock' | 'real' | 'disabled';
  status?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO connector_installations (
        tenant, company_id, connector_id, mode, status, enabled, config_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant, company_id, connector_id) DO UPDATE SET
        mode = excluded.mode,
        status = excluded.status,
        enabled = excluded.enabled,
        config_json = excluded.config_json,
        updated_at = excluded.updated_at`,
      [
        data.tenant,
        data.company_id || null,
        data.connector_id,
        data.mode || 'mock',
        data.status || 'enabled',
        data.enabled === false ? 0 : 1,
        JSON.stringify(data.config || {}),
        now,
        now,
      ],
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID || 0);
      }
    );
  });
}

export function getConnectorInstallations(tenant: string, company_id?: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const sql = company_id
      ? `SELECT * FROM connector_installations WHERE tenant = ? AND (company_id = ? OR company_id IS NULL) ORDER BY connector_id`
      : `SELECT * FROM connector_installations WHERE tenant = ? ORDER BY connector_id`;
    const params = company_id ? [tenant, company_id] : [tenant];
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows || []).map((row: any) => ({
        ...row,
        enabled: row.enabled === 1,
        config: JSON.parse(row.config_json || '{}'),
      })));
    });
  });
}

export function saveConnectorActionRun(data: {
  tenant: string;
  company_id?: number;
  task_id?: number;
  connector_id: string;
  action_id: string;
  mode: string;
  status: string;
  policy_effect: string;
  risk_level: string;
  side_effect: string;
  reversible: boolean;
  idempotency_key?: string;
  external_reference?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  requested_by?: string;
  completed?: boolean;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO connector_action_runs (
        tenant, company_id, task_id, connector_id, action_id, mode, status, policy_effect,
        risk_level, side_effect, reversible, idempotency_key, external_reference,
        payload_json, result_json, requested_by, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.tenant,
      data.company_id || null,
      data.task_id || null,
      data.connector_id,
      data.action_id,
      data.mode,
      data.status,
      data.policy_effect,
      data.risk_level,
      data.side_effect,
      data.reversible ? 1 : 0,
      data.idempotency_key || null,
      data.external_reference || null,
      JSON.stringify(data.payload || {}),
      JSON.stringify(data.result || {}),
      data.requested_by || 'agent',
      now,
      data.completed ? now : null,
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getConnectorActionRuns(tenant: string, limit = 30): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM connector_action_runs WHERE tenant = ? ORDER BY created_at DESC LIMIT ?`,
      [tenant, Math.max(1, Math.min(limit, 100))],
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []).map((row: any) => ({
          ...row,
          reversible: row.reversible === 1,
          payload: JSON.parse(row.payload_json || '{}'),
          result: JSON.parse(row.result_json || '{}'),
        })));
      }
    );
  });
}

export function savePolicyDecision(data: {
  tenant: string;
  company_id?: number;
  task_id?: number;
  connector_action_run_id?: number;
  policy_pack: string;
  effect: string;
  risk_level: string;
  side_effect: string;
  reason: string;
  matched_rules: string[];
  input: Record<string, unknown>;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO policy_decisions (
        tenant, company_id, task_id, connector_action_run_id, policy_pack, effect,
        risk_level, side_effect, reason, matched_rules_json, input_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.tenant,
      data.company_id || null,
      data.task_id || null,
      data.connector_action_run_id || null,
      data.policy_pack,
      data.effect,
      data.risk_level,
      data.side_effect,
      data.reason,
      JSON.stringify(data.matched_rules),
      JSON.stringify(data.input),
      new Date().toISOString(),
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    stmt.finalize();
  });
}

export function getPolicyDecisions(tenant: string, limit = 30): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM policy_decisions WHERE tenant = ? ORDER BY created_at DESC LIMIT ?`,
      [tenant, Math.max(1, Math.min(limit, 100))],
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []).map((row: any) => ({
          ...row,
          matched_rules: JSON.parse(row.matched_rules_json || '[]'),
          input: JSON.parse(row.input_json || '{}'),
        })));
      }
    );
  });
}


// --- Headquarters, War Room, and unified History functions ---
function allQuery(sql: string, params: unknown[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function getQuery(sql: string, params: unknown[] = []): Promise<any | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function runQuery(sql: string, params: unknown[] = []): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function getTenantTasks(tenant: string, limit = 250): Promise<any[]> {
  return allQuery(
    `SELECT t.*, c.name AS company_name
       FROM tasks t
       JOIN companies c ON c.id = t.company_id
      WHERE c.tenant = ?
      ORDER BY t.updated_at DESC
      LIMIT ?`,
    [tenant, Math.max(1, Math.min(limit, 500))]
  );
}

export function getTenantApprovals(tenant: string, limit = 250): Promise<any[]> {
  return allQuery(
    `SELECT a.*, c.name AS company_name, t.title AS task_title
       FROM approvals a
       JOIN companies c ON c.id = a.company_id
       LEFT JOIN tasks t ON t.id = a.task_id
      WHERE c.tenant = ?
      ORDER BY a.updated_at DESC
      LIMIT ?`,
    [tenant, Math.max(1, Math.min(limit, 500))]
  );
}

export function getTenantOutputs(tenant: string, limit = 250): Promise<any[]> {
  return allQuery(
    `SELECT o.*, c.name AS company_name, t.title AS task_title
       FROM outputs o
       JOIN companies c ON c.id = o.company_id
       LEFT JOIN tasks t ON t.id = o.task_id
      WHERE c.tenant = ?
      ORDER BY o.created_at DESC
      LIMIT ?`,
    [tenant, Math.max(1, Math.min(limit, 500))]
  );
}

export function getTenantValidationRuns(tenant: string, limit = 250): Promise<any[]> {
  return allQuery(
    `SELECT v.*, c.name AS company_name, t.title AS task_title
       FROM validation_runs v
       JOIN companies c ON c.id = v.company_id
       LEFT JOIN tasks t ON t.id = v.task_id
      WHERE v.tenant = ?
      ORDER BY v.started_at DESC
      LIMIT ?`,
    [tenant, Math.max(1, Math.min(limit, 500))]
  ).then((rows) => rows.map((row: any) => ({
    ...row,
    findings: JSON.parse(row.findings_json || '[]'),
    blocking_findings: JSON.parse(row.blocking_findings_json || '[]'),
    dissent: JSON.parse(row.dissent_json || '[]'),
    requires_human_approval: row.requires_human_approval === 1,
  })));
}

export function getTenantUsageEvents(tenant: string, limit = 250): Promise<any[]> {
  return allQuery(
    `SELECT u.*, c.name AS company_name
       FROM usage_events u
       LEFT JOIN companies c ON c.id = u.company_id
      WHERE u.tenant = ?
      ORDER BY u.created_at DESC
      LIMIT ?`,
    [tenant, Math.max(1, Math.min(limit, 500))]
  );
}

export function getTenantActivityEvents(tenant: string, limit = 250): Promise<any[]> {
  return allQuery(
    `SELECT e.*, c.name AS company_name
       FROM activity_events e
       LEFT JOIN companies c ON c.id = e.company_id
      WHERE e.company_id IS NULL OR c.tenant = ?
      ORDER BY e.created_at DESC
      LIMIT ?`,
    [tenant, Math.max(1, Math.min(limit, 500))]
  );
}

export function getWorkerHeartbeats(limit = 20): Promise<any[]> {
  return allQuery(
    `SELECT * FROM worker_heartbeats ORDER BY last_seen_at DESC LIMIT ?`,
    [Math.max(1, Math.min(limit, 100))]
  ).then((rows) => rows.map((row: any) => ({
    ...row,
    details: (() => {
      try { return JSON.parse(row.details || '{}'); } catch { return { raw: row.details }; }
    })(),
  })));
}

export function upsertOperationsIncident(data: {
  tenant: string;
  company_id?: number;
  fingerprint: string;
  source_type: string;
  source_id?: string | number;
  severity: string;
  title: string;
  description?: string;
  remediation?: string;
  target_type?: string;
  target_id?: number;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(
      `INSERT INTO operations_incidents (
        tenant, company_id, fingerprint, source_type, source_id, severity, title, description,
        status, remediation, target_type, target_id, metadata_json, created_at, updated_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(tenant, fingerprint) DO UPDATE SET
        company_id = excluded.company_id,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        severity = excluded.severity,
        title = excluded.title,
        description = excluded.description,
        remediation = excluded.remediation,
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        metadata_json = excluded.metadata_json,
        status = CASE
          WHEN operations_incidents.status = 'acknowledged' THEN 'acknowledged'
          WHEN operations_incidents.status = 'resolved' AND excluded.source_type IN ('worker', 'execution_run', 'task') THEN 'open'
          WHEN operations_incidents.status = 'resolved' THEN 'resolved'
          ELSE 'open'
        END,
        updated_at = excluded.updated_at,
        resolved_at = NULL`,
      [
        data.tenant,
        data.company_id || null,
        data.fingerprint,
        data.source_type,
        data.source_id === undefined ? null : String(data.source_id),
        data.severity,
        data.title,
        data.description || null,
        data.remediation || null,
        data.target_type || null,
        data.target_id || null,
        JSON.stringify(data.metadata || {}),
        timestamp,
        timestamp,
      ],
      function (this: RunResult, err: Error | null) {
        if (err) { reject(err); return; }
        if (this.lastID) { resolve(this.lastID); return; }
        db.get(
          `SELECT id FROM operations_incidents WHERE tenant = ? AND fingerprint = ?`,
          [data.tenant, data.fingerprint],
          (getErr, row: any) => getErr ? reject(getErr) : resolve(Number(row?.id || 0))
        );
      }
    );
  });
}

export async function resolveInactiveOperationsIncidents(tenant: string, activeFingerprints: string[]): Promise<void> {
  const timestamp = new Date().toISOString();
  if (activeFingerprints.length === 0) {
    await runQuery(
      `UPDATE operations_incidents
          SET status = 'resolved', resolved_at = ?, updated_at = ?
        WHERE tenant = ? AND source_type != 'manual' AND status != 'resolved'`,
      [timestamp, timestamp, tenant]
    );
    return;
  }
  const placeholders = activeFingerprints.map(() => '?').join(',');
  await runQuery(
    `UPDATE operations_incidents
        SET status = 'resolved', resolved_at = ?, updated_at = ?
      WHERE tenant = ?
        AND source_type != 'manual'
        AND status != 'resolved'
        AND fingerprint NOT IN (${placeholders})`,
    [timestamp, timestamp, tenant, ...activeFingerprints]
  );
}

export function getOperationsIncidents(tenant: string, limit = 250): Promise<any[]> {
  return allQuery(
    `SELECT i.*, c.name AS company_name
       FROM operations_incidents i
       LEFT JOIN companies c ON c.id = i.company_id
      WHERE i.tenant = ?
      ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
               CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
               i.updated_at DESC
      LIMIT ?`,
    [tenant, Math.max(1, Math.min(limit, 500))]
  ).then((rows) => rows.map((row: any) => ({
    ...row,
    metadata: JSON.parse(row.metadata_json || '{}'),
  })));
}

export function updateOperationsIncident(data: {
  tenant: string;
  incident_id: number;
  status: 'open' | 'acknowledged' | 'resolved';
}): Promise<boolean> {
  const timestamp = new Date().toISOString();
  return runQuery(
    `UPDATE operations_incidents
        SET status = ?, updated_at = ?, resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE NULL END
      WHERE id = ? AND tenant = ?`,
    [data.status, timestamp, data.status, timestamp, data.incident_id, data.tenant]
  ).then((result) => result.changes > 0);
}

export function saveRecoveryAction(data: {
  tenant: string;
  company_id?: number;
  incident_id?: number;
  action_type: string;
  target_type?: string;
  target_id?: number;
  status: string;
  requested_by?: string;
  result?: string;
  completed?: boolean;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(
      `INSERT INTO recovery_actions (
        tenant, company_id, incident_id, action_type, target_type, target_id, status,
        requested_by, result, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.tenant,
        data.company_id || null,
        data.incident_id || null,
        data.action_type,
        data.target_type || null,
        data.target_id || null,
        data.status,
        data.requested_by || 'founder',
        data.result || null,
        timestamp,
        data.completed ? timestamp : null,
      ],
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

export function getRecoveryActions(tenant: string, limit = 100): Promise<any[]> {
  return allQuery(
    `SELECT r.*, c.name AS company_name, i.title AS incident_title
       FROM recovery_actions r
       LEFT JOIN companies c ON c.id = r.company_id
       LEFT JOIN operations_incidents i ON i.id = r.incident_id
      WHERE r.tenant = ?
      ORDER BY r.created_at DESC
      LIMIT ?`,
    [tenant, Math.max(1, Math.min(limit, 250))]
  );
}

export async function retryExecutionRun(tenant: string, runId: number): Promise<{ changed: boolean; company_id?: number }> {
  const run = await getQuery(`SELECT id, company_id, status FROM execution_runs WHERE id = ? AND tenant = ?`, [runId, tenant]);
  if (!run) return { changed: false };
  const timestamp = new Date().toISOString();
  const result = await runQuery(
    `UPDATE execution_runs
        SET status = 'queued', rollback_state = 'ready', error_message = NULL,
            claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
            attempt_count = 0, updated_at = ?, completed_at = NULL
      WHERE id = ? AND tenant = ? AND status IN ('blocked', 'failed', 'error')`,
    [timestamp, runId, tenant]
  );
  return { changed: result.changes > 0, company_id: run.company_id || undefined };
}

export async function requeueTask(tenant: string, taskId: number): Promise<{ changed: boolean; company_id?: number }> {
  const task = await getQuery(
    `SELECT t.id, t.company_id, t.status
       FROM tasks t JOIN companies c ON c.id = t.company_id
      WHERE t.id = ? AND c.tenant = ?`,
    [taskId, tenant]
  );
  if (!task) return { changed: false };
  const timestamp = new Date().toISOString();
  const result = await runQuery(
    `UPDATE tasks
        SET status = 'active', last_error = NULL, claimed_by = NULL, claimed_at = NULL,
            lease_expires_at = NULL, heartbeat_at = NULL, attempt_count = 0, updated_at = ?
      WHERE id = ? AND status IN ('blocked', 'failed', 'error')`,
    [timestamp, taskId]
  );
  return { changed: result.changes > 0, company_id: task.company_id || undefined };
}

export function saveTenantActivityEvent(data: {
  tenant: string;
  company_id?: number;
  event_type: string;
  title: string;
  description?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const verifyCompany = data.company_id
      ? `SELECT id FROM companies WHERE id = ? AND tenant = ?`
      : null;
    const insert = () => db.run(
      `INSERT INTO activity_events (company_id, event_type, title, description, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [data.company_id || null, data.event_type, data.title, data.description || null, new Date().toISOString()],
      function (this: RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    if (!verifyCompany) { insert(); return; }
    db.get(verifyCompany, [data.company_id, data.tenant], (err, row) => {
      if (err) reject(err);
      else if (!row) reject(new Error('Company does not belong to tenant'));
      else insert();
    });
  });
}
