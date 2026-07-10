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

    const cookieStore = await req.cookies;
    const tenant = cookieStore.get('tenant')?.value || 'default';
    const tenantPath = ensureTenantDirectories(tenant);
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
