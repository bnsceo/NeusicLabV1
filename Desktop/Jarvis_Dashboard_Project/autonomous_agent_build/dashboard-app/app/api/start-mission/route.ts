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

    const cookieStore = await req.cookies;
    const tenant = cookieStore.get('tenant')?.value || 'default';
    const tenantPath = ensureTenantDirectories(tenant);

    const projectRoot = path.join(process.cwd(), '..');
    const scriptPath = path.join(projectRoot, 'backend', 'app', 'agents', 'orchestrator', 'supervisor_router.py');

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: 'Supervisor script not found' }, { status: 404 });
    }

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
