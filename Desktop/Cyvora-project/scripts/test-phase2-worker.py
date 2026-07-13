#!/usr/bin/env python3
"""Smoke-test candidate/final output policy with isolated temporary SQLite databases."""
import json, os, sqlite3, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def run_case(risk: str):
    temp = Path(tempfile.mkdtemp(prefix='cyvora-phase2-'))
    db = temp / 'missions.db'; tenants = temp / 'tenants'; personas = temp / 'personas'
    personas.mkdir(); (personas / 'executive-ai.md').write_text('You are Executive AI.', encoding='utf-8')
    conn = sqlite3.connect(db)
    conn.executescript('''
      CREATE TABLE execution_runs(id INTEGER PRIMARY KEY,tenant TEXT,request_id INTEGER,mission_id INTEGER,company_id INTEGER,goal TEXT,runtime_plan TEXT,runtime_mode TEXT,status TEXT,rollback_state TEXT,paid_ai INTEGER,mock_mode INTEGER,error_message TEXT,started_at TEXT,updated_at TEXT,completed_at TEXT);
      CREATE TABLE tasks(id INTEGER PRIMARY KEY,company_id INTEGER,department_id INTEGER,team_id INTEGER,title TEXT,description TEXT,workflow_stage TEXT,status TEXT,priority TEXT,assigned_agent TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE approvals(id INTEGER PRIMARY KEY,company_id INTEGER,task_id INTEGER,title TEXT,summary TEXT,status TEXT,risk_level TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE outputs(id INTEGER PRIMARY KEY,company_id INTEGER,task_id INTEGER,title TEXT,output_type TEXT,status TEXT,summary TEXT,created_at TEXT);
      CREATE TABLE activity_events(id INTEGER PRIMARY KEY,company_id INTEGER,event_type TEXT,title TEXT,description TEXT,created_at TEXT);
    ''')
    plan = {'models': ['mock']}; timestamp = '2026-07-13T00:00:00+00:00'
    conn.execute('INSERT INTO execution_runs VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ('default',1,1,1,'goal',json.dumps(plan),'local','queued','not_required',0,1,None,timestamp,timestamp,None))
    conn.execute('INSERT INTO tasks VALUES(1,1,NULL,NULL,?,?,?,?,?,?,?,?)', ('Test task','Do work','Generation','active','high','Executive AI',timestamp,timestamp))
    conn.execute('INSERT INTO approvals VALUES(1,1,1,?,?,?,?,?,?)', ('Approve task','ok','approved',risk,timestamp,timestamp))
    conn.commit(); conn.close()
    snapshot_dir = tenants / 'default' / 'briefings'; snapshot_dir.mkdir(parents=True)
    (snapshot_dir / 'harness_approval_1.json').write_text(json.dumps({'approval_state':'approved','runtime_plan':plan}), encoding='utf-8')
    env = os.environ.copy(); env.update({'MISSIONS_DB_PATH':str(db),'TENANTS_ROOT':str(tenants),'AGENCY_AGENTS_DIR':str(personas),'JARVIS_WORKSPACE_ROOT':str(ROOT),'MOCK_MODE':'true'})
    result = subprocess.run(['python', str(ROOT/'worker/execution_worker.py')], env=env, text=True, capture_output=True, check=False)
    conn = sqlite3.connect(db); conn.row_factory = sqlite3.Row
    output = dict(conn.execute('SELECT * FROM outputs').fetchone()); task = dict(conn.execute('SELECT * FROM tasks').fetchone()); run = dict(conn.execute('SELECT * FROM execution_runs').fetchone())
    validations = conn.execute('SELECT COUNT(*) FROM validation_runs').fetchone()[0]; usage = conn.execute('SELECT COUNT(*) FROM usage_events').fetchone()[0]
    result_approvals = conn.execute("SELECT COUNT(*) FROM approvals WHERE approval_type='result_acceptance'").fetchone()[0]; conn.close()
    assert result.returncode == 0 and validations == 1 and usage == 1
    if risk == 'medium':
        assert output['status'] == 'final' and task['status'] == 'completed' and run['status'] == 'completed' and result_approvals == 0
    else:
        assert output['status'] == 'candidate' and task['status'] == 'awaiting_result_approval' and run['status'] == 'awaiting_result_approval' and result_approvals == 1

if __name__ == '__main__':
    run_case('medium'); run_case('high'); print('Phase 2 worker smoke tests passed.')
