import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'missions.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

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
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY(request_id) REFERENCES self_coding_requests(id),
    FOREIGN KEY(mission_id) REFERENCES missions(id),
    FOREIGN KEY(company_id) REFERENCES companies(id)
  )
`);

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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO tasks (
        company_id, department_id, team_id, title, description, workflow_stage,
        status, priority, assigned_agent, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      now,
      now,
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
}): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO approvals (company_id, task_id, title, summary, status, risk_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      data.company_id,
      data.task_id || null,
      data.title,
      data.summary || '',
      data.status,
      data.risk_level,
      now,
      now,
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
      function (this: sqlite3.RunResult, err: Error | null) {
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
  const companies = await getCompanies(tenant);
  for (const company of companies) {
    await runDelete(`DELETE FROM activity_events WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM outputs WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM approvals WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM tasks WHERE company_id = ?`, [company.id]);
    await runDelete(`DELETE FROM connectors WHERE company_id = ?`, [company.id]);

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
