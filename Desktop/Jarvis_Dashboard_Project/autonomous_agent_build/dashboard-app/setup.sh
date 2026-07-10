#!/bin/bash
# Create all files for multi-tenant + security dashboard

set -e

mkdir -p lib app/api/approve app/api/repair app/api/tenants app/api/tenant/switch app/security app/api/security-dashboard

# 1. Tenant utility
cat > lib/tenant.ts << 'EOF'
import { cookies } from 'next/headers';
import path from 'path';
import fs from 'fs';

const TENANTS_ROOT = path.join(process.cwd(), '..', 'tenants');

export function getTenantId(): string {
  const cookieStore = cookies();
  return cookieStore.get('tenant')?.value || 'default';
}

export function getTenantPath(tenantId?: string): string {
  const id = tenantId || getTenantId();
  return path.join(TENANTS_ROOT, id);
}

export function ensureTenantDirectories(tenantId?: string) {
  const tenantPath = getTenantPath(tenantId);
  const dirs = ['logs', 'briefings', 'security'];
  for (const d of dirs) {
    const dirPath = path.join(tenantPath, d);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  return tenantPath;
}

export function listTenants(): string[] {
  if (!fs.existsSync(TENANTS_ROOT)) return ['default'];
  return fs.readdirSync(TENANTS_ROOT).filter((f) =>
    fs.statSync(path.join(TENANTS_ROOT, f)).isDirectory()
  );
}

export function createTenant(name: string): void {
  const tenantPath = path.join(TENANTS_ROOT, name);
  if (!fs.existsSync(tenantPath)) {
    fs.mkdirSync(tenantPath, { recursive: true });
    const dirs = ['logs', 'briefings', 'security'];
    for (const d of dirs) {
      fs.mkdirSync(path.join(tenantPath, d), { recursive: true });
    }
    const defaultLog = path.join(process.cwd(), '..', 'logs', 'error.log');
    if (fs.existsSync(defaultLog)) {
      fs.copyFileSync(defaultLog, path.join(tenantPath, 'logs', 'error.log'));
    }
  }
}
EOF

# 2. Briefing API
cat > app/api/briefing/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getTenantPath, ensureTenantDirectories } from '@/lib/tenant';

export async function GET() {
  try {
    const tenantPath = ensureTenantDirectories();
    const briefingPath = path.join(tenantPath, 'briefings', 'mission_briefing.md');
    const statusPath = path.join(tenantPath, 'briefings', 'status.json');

    let content = '';
    try {
      content = fs.readFileSync(briefingPath, 'utf-8');
    } catch {
      return NextResponse.json({
        objective: 'No active mission',
        agents: [],
        status: 'pending',
        timestamp: new Date().toISOString(),
      });
    }

    let statusData = { status: 'pending', objective: '', timestamp: new Date().toISOString() };
    try {
      statusData = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    } catch {
      const initial = { status: 'pending', objective: '', timestamp: new Date().toISOString() };
      fs.writeFileSync(statusPath, JSON.stringify(initial, null, 2));
    }

    const briefing = parseBriefing(content);
    briefing.status = statusData.status;
    briefing.timestamp = statusData.timestamp;

    return NextResponse.json(briefing);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load briefing' }, { status: 500 });
  }
}

function parseBriefing(content: string) {
  const lines = content.split('\n');
  let objective = '';
  const agents: { name: string; task: string; output: string }[] = [];
  let currentAgent: { name: string; task: string; output: string } | null = null;
  let collecting = false;

  for (const line of lines) {
    if (line.startsWith('**Objective:**')) {
      objective = line.replace('**Objective:**', '').trim();
    } else if (line.startsWith('## Agent:')) {
      if (currentAgent) agents.push(currentAgent);
      const name = line.replace('## Agent:', '').trim();
      currentAgent = { name, task: '', output: '' };
      collecting = false;
    } else if (currentAgent && line.startsWith('**Task:**')) {
      currentAgent.task = line.replace('**Task:**', '').trim();
      collecting = true;
    } else if (currentAgent && collecting) {
      currentAgent.output += line + '\n';
    }
  }
  if (currentAgent) agents.push(currentAgent);
  return {
    objective,
    agents,
    status: 'pending',
    timestamp: new Date().toISOString(),
  };
}
EOF

# 3. Start Mission API
cat > app/api/start-mission/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { sendSSEEvent } from '../stream/route';
import { getTenantPath, ensureTenantDirectories } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const { goal } = await req.json();
    if (!goal) {
      return NextResponse.json({ error: 'Goal is required' }, { status: 400 });
    }

    const projectRoot = path.join(process.cwd(), '..');
    const scriptPath = path.join(projectRoot, 'backend', 'app', 'agents', 'orchestrator', 'supervisor_router.py');

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: 'Supervisor script not found' }, { status: 404 });
    }

    const tenantPath = ensureTenantDirectories();

    sendSSEEvent({ type: 'start', message: '🚀 Mission started', goal });

    const pythonProcess = spawn('python3', [scriptPath, goal], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        sendSSEEvent({ type: 'log', message: line });
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        sendSSEEvent({ type: 'error', message: line });
      }
    });

    return new Promise((resolve) => {
      pythonProcess.on('close', async (code) => {
        if (code === 0) {
          const rootBriefing = path.join(projectRoot, 'mission_briefing.md');
          const tenantBriefing = path.join(tenantPath, 'briefings', 'mission_briefing.md');
          const rootStatus = path.join(projectRoot, 'mission_status.json');
          const tenantStatus = path.join(tenantPath, 'briefings', 'status.json');
          if (fs.existsSync(rootBriefing)) {
            fs.copyFileSync(rootBriefing, tenantBriefing);
          }
          if (fs.existsSync(rootStatus)) {
            fs.copyFileSync(rootStatus, tenantStatus);
          }

          let content = '';
          try {
            content = fs.readFileSync(tenantBriefing, 'utf-8');
          } catch {
            content = 'No briefing generated.';
          }
          const briefing = parseBriefing(content);
          let status = 'pending';
          try {
            const statusData = JSON.parse(fs.readFileSync(tenantStatus, 'utf-8'));
            status = statusData.status;
          } catch {}
          briefing.status = status;
          sendSSEEvent({ type: 'done', briefing });
          resolve(NextResponse.json({ success: true, briefing }));
        } else {
          sendSSEEvent({ type: 'error', message: `Process exited with code ${code}` });
          resolve(NextResponse.json({ error: 'Mission failed' }, { status: 500 }));
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseBriefing(content: string) {
  const lines = content.split('\n');
  let objective = '';
  const agents: { name: string; task: string; output: string }[] = [];
  let currentAgent: { name: string; task: string; output: string } | null = null;
  let collecting = false;

  for (const line of lines) {
    if (line.startsWith('**Objective:**')) {
      objective = line.replace('**Objective:**', '').trim();
    } else if (line.startsWith('## Agent:')) {
      if (currentAgent) agents.push(currentAgent);
      const name = line.replace('## Agent:', '').trim();
      currentAgent = { name, task: '', output: '' };
      collecting = false;
    } else if (currentAgent && line.startsWith('**Task:**')) {
      currentAgent.task = line.replace('**Task:**', '').trim();
      collecting = true;
    } else if (currentAgent && collecting) {
      currentAgent.output += line + '\n';
    }
  }
  if (currentAgent) agents.push(currentAgent);
  return { objective, agents, status: 'pending', timestamp: new Date().toISOString() };
}
EOF

# 4. Approve API
cat > app/api/approve/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { getTenantPath, ensureTenantDirectories } from '@/lib/tenant';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { action, objective } = await req.json();
    if (!action || !['decree', 'abandon'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const tenantPath = ensureTenantDirectories();
    const briefingPath = path.join(tenantPath, 'briefings', 'mission_briefing.md');
    const statusPath = path.join(tenantPath, 'briefings', 'status.json');

    let content = '';
    try {
      content = fs.readFileSync(briefingPath, 'utf-8');
    } catch {
      return NextResponse.json({ error: 'No mission briefing found' }, { status: 404 });
    }

    const newStatus = action === 'decree' ? 'approved' : 'abandoned';

    if (action === 'decree') {
      const projectRoot = path.join(process.cwd(), '..');
      try {
        await execAsync('git add .', { cwd: projectRoot });
        await execAsync(`git commit -m "DECREED: ${objective.slice(0, 80)}"`, { cwd: projectRoot });
        await execAsync('git push', { cwd: projectRoot });
      } catch (gitError: any) {
        console.error('Git error:', gitError);
      }
    }

    const statusData = { status: newStatus, objective, timestamp: new Date().toISOString() };
    fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2));

    const briefing = parseBriefing(content);
    briefing.status = newStatus;
    briefing.timestamp = statusData.timestamp;

    return NextResponse.json(briefing);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseBriefing(content: string) {
  const lines = content.split('\n');
  let objective = '';
  const agents: { name: string; task: string; output: string }[] = [];
  let currentAgent: { name: string; task: string; output: string } | null = null;
  let collecting = false;

  for (const line of lines) {
    if (line.startsWith('**Objective:**')) {
      objective = line.replace('**Objective:**', '').trim();
    } else if (line.startsWith('## Agent:')) {
      if (currentAgent) agents.push(currentAgent);
      const name = line.replace('## Agent:', '').trim();
      currentAgent = { name, task: '', output: '' };
      collecting = false;
    } else if (currentAgent && line.startsWith('**Task:**')) {
      currentAgent.task = line.replace('**Task:**', '').trim();
      collecting = true;
    } else if (currentAgent && collecting) {
      currentAgent.output += line + '\n';
    }
  }
  if (currentAgent) agents.push(currentAgent);
  return { objective, agents, status: 'pending', timestamp: new Date().toISOString() };
}
EOF

# 5. War Room API
cat > app/api/warroom/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getTenantPath, ensureTenantDirectories } from '@/lib/tenant';

export async function GET() {
  try {
    const tenantPath = ensureTenantDirectories();
    const logPath = path.join(tenantPath, 'logs', 'error.log');
    let incidents = [];

    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      incidents = lines.map((line, index) => {
        const match = line.match(/\[(.*?)\]\s*(\w+):\s*(.*)/);
        if (match) {
          return {
            id: index + 1,
            timestamp: match[1],
            severity: match[2].toLowerCase(),
            title: match[3],
          };
        }
        return { id: index + 1, timestamp: new Date().toISOString(), severity: 'info', title: line };
      });
    } catch {
      incidents = [
        { id: 1, timestamp: new Date().toISOString(), severity: 'info', title: 'No errors detected. System healthy.' },
      ];
    }

    return NextResponse.json(incidents);
  } catch (error) {
    return NextResponse.json([]);
  }
}
EOF

# 6. Repair API
cat > app/api/repair/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { sendSSEEvent } from '../stream/route';
import { getTenantPath, ensureTenantDirectories } from '@/lib/tenant';

const SECURITY_KEYWORDS = ['breach', 'intrusion', 'malware', 'unauthorized', 'vulnerability', 'exploit', 'ransomware', 'phishing', 'compromise'];

export async function POST(req: NextRequest) {
  try {
    const { alert } = await req.json();
    if (!alert) {
      return NextResponse.json({ error: 'Alert description is required' }, { status: 400 });
    }

    const projectRoot = path.join(process.cwd(), '..');
    const tenantPath = ensureTenantDirectories();

    const isSecurity = SECURITY_KEYWORDS.some(keyword => alert.toLowerCase().includes(keyword));
    let scriptPath;
    let goal = alert;
    if (isSecurity) {
      scriptPath = path.join(projectRoot, 'backend', 'app', 'agents', 'orchestrator', 'supervisor_router.py');
      goal = `Investigate the following security incident and provide a detailed report with remediation steps: ${alert}`;
      sendSSEEvent({ type: 'start', message: '🛡️ Security Supervisor engaged', alert });
    } else {
      scriptPath = path.join(projectRoot, 'backend', 'app', 'agents', 'orchestrator', 'war_room_monitor.py');
      sendSSEEvent({ type: 'start', message: '🛡️ War Room engaged', alert });
    }

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: 'Agent script not found' }, { status: 404 });
    }

    const pythonProcess = spawn('python3', [scriptPath, goal], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        sendSSEEvent({ type: 'log', message: line });
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        sendSSEEvent({ type: 'error', message: line });
      }
    });

    return new Promise((resolve) => {
      pythonProcess.on('close', async (code) => {
        if (code === 0) {
          let sourceBriefing, destBriefing;
          if (isSecurity) {
            sourceBriefing = path.join(projectRoot, 'mission_briefing.md');
            destBriefing = path.join(tenantPath, 'briefings', 'mission_briefing.md');
          } else {
            sourceBriefing = path.join(projectRoot, 'repair_briefing.md');
            destBriefing = path.join(tenantPath, 'briefings', 'repair_briefing.md');
          }
          if (fs.existsSync(sourceBriefing)) {
            fs.copyFileSync(sourceBriefing, destBriefing);
          }
          let content = '';
          try {
            content = fs.readFileSync(destBriefing, 'utf-8');
          } catch {
            content = 'No briefing generated.';
          }
          const briefing = { objective: alert, content };
          sendSSEEvent({ type: 'done', briefing });
          resolve(NextResponse.json({ success: true, briefing, security: isSecurity }));
        } else {
          sendSSEEvent({ type: 'error', message: `Process exited with code ${code}` });
          resolve(NextResponse.json({ error: 'Repair mission failed' }, { status: 500 }));
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
EOF

# 7. Tenants list/create API
cat > app/api/tenants/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { listTenants, createTenant } from '@/lib/tenant';

export async function GET() {
  try {
    const tenants = listTenants();
    return NextResponse.json(tenants);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list tenants' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 });
    }
    createTenant(name.trim());
    return NextResponse.json({ success: true, tenants: listTenants() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
EOF

# 8. Tenant switch API
cat > app/api/tenant/switch/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { tenant } = await req.json();
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set('tenant', tenant, { path: '/' });
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to switch tenant' }, { status: 500 });
  }
}
EOF

# 9. Security Dashboard page
cat > app/security/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';

interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  status: 'open' | 'in-progress' | 'resolved';
  date: string;
}

interface Compliance {
  standard: string;
  status: 'compliant' | 'non-compliant' | 'partial';
  details: string;
  lastAudit: string;
}

interface SecurityIncident {
  id: string;
  title: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
  remediation: string;
}

export default function SecurityDashboard() {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [compliance, setCompliance] = useState<Compliance[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      const res = await fetch('/api/security-dashboard');
      const data = await res.json();
      setVulnerabilities(data.vulnerabilities || []);
      setCompliance(data.compliance || []);
      setIncidents(data.incidents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const map: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-black',
      low: 'bg-blue-400 text-white',
    };
    return map[severity] || 'bg-gray-500';
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'open': 'text-red-400',
      'in-progress': 'text-yellow-400',
      'resolved': 'text-green-400',
      'investigating': 'text-orange-400',
    };
    return map[status] || 'text-gray-400';
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 p-6 text-white flex items-center justify-center">
      <div className="text-xl">Loading security dashboard...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
          🛡️ Security Dashboard
        </h1>

        <div className="glass glass-dark p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Compliance Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {compliance.length === 0 && <p className="text-slate-400 col-span-3">No compliance data available.</p>}
            {compliance.map((item, idx) => (
              <div key={idx} className="bg-slate-800/40 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <span className="font-medium">{item.standard}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.status === 'compliant' ? 'bg-green-500/20 text-green-300' :
                    item.status === 'non-compliant' ? 'bg-red-500/20 text-red-300' :
                    'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{item.details}</p>
                <p className="text-xs text-slate-500 mt-2">Last audit: {item.lastAudit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass glass-dark p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Open Vulnerabilities</h2>
          {vulnerabilities.length === 0 && <p className="text-slate-400">No vulnerabilities reported.</p>}
          <div className="space-y-3">
            {vulnerabilities.map((v) => (
              <div key={v.id} className="bg-slate-800/40 rounded-lg p-4 flex flex-wrap justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(v.severity)}`}>
                      {v.severity.toUpperCase()}
                    </span>
                    <span className={`text-sm ${getStatusColor(v.status)}`}>{v.status}</span>
                  </div>
                  <h4 className="font-medium mt-1">{v.title}</h4>
                  <p className="text-sm text-slate-400">{v.description}</p>
                  <p className="text-xs text-slate-500 mt-1">Reported: {v.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass glass-dark p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Security Incidents</h2>
          {incidents.length === 0 && <p className="text-slate-400">No incidents recorded.</p>}
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div key={inc.id} className="bg-slate-800/40 rounded-lg p-4">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(inc.severity)}`}>
                        {inc.severity.toUpperCase()}
                      </span>
                      <span className={`text-sm ${getStatusColor(inc.status)}`}>{inc.status}</span>
                    </div>
                    <h4 className="font-medium mt-1">{inc.title}</h4>
                    <p className="text-sm text-slate-400">Remediation: {inc.remediation || 'Pending'}</p>
                    <p className="text-xs text-slate-500 mt-1">{inc.timestamp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-xs">
          🔐 Security data is tenant‑specific.
        </div>
      </div>

      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .glass-dark {
          background: rgba(10, 10, 20, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </div>
  );
}
EOF

# 10. Security Dashboard API
cat > app/api/security-dashboard/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getTenantPath, ensureTenantDirectories } from '@/lib/tenant';

export async function GET() {
  try {
    const tenantPath = ensureTenantDirectories();
    const securityPath = path.join(tenantPath, 'security');
    const incidentsPath = path.join(tenantPath, 'logs', 'error.log');

    const vulnerabilities = [
      { id: 'VULN-001', title: 'Outdated TLS version on API gateway', severity: 'medium', description: 'TLS 1.0 is still supported. Disable it.', status: 'open', date: '2026-07-09' },
      { id: 'VULN-002', title: 'Missing rate limiting on login endpoint', severity: 'high', description: 'Brute force attacks possible.', status: 'in-progress', date: '2026-07-08' },
    ];

    const compliance = [
      { standard: 'SOC 2', status: 'partial', details: 'In progress – audit due Q3 2026', lastAudit: '2026-06-15' },
      { standard: 'GDPR', status: 'compliant', details: 'All data processing agreements updated', lastAudit: '2026-07-01' },
    ];

    let incidents = [];
    try {
      const logContent = fs.readFileSync(incidentsPath, 'utf-8');
      const lines = logContent.split('\n').filter(Boolean);
      const errorLines = lines.filter(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('warning'));
      incidents = errorLines.slice(-3).map((line, idx) => {
        const match = line.match(/\[(.*?)\]\s*(\w+):\s*(.*)/);
        const severity = match ? (match[2].toLowerCase().includes('error') ? 'high' : 'medium') : 'low';
        const title = match ? match[3] : line;
        return {
          id: `INC-${String(idx+1).padStart(3, '0')}`,
          title: title,
          timestamp: match ? match[1] : new Date().toISOString(),
          severity: severity,
          status: 'open',
          remediation: 'Pending investigation'
        };
      });
    } catch {}

    return NextResponse.json({
      vulnerabilities,
      compliance,
      incidents,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load security data' }, { status: 500 });
  }
}
EOF

echo "✅ All files created successfully!"
