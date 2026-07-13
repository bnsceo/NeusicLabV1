import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ensureTenantDirectories } from '@/lib/tenant';
import { ensureDemoShowcase } from '@/lib/demoShowcase';
import { isDemoMode } from '@/lib/runtimeMode';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await req.cookies;
    const tenant = cookieStore.get('tenant')?.value || 'default';
    if (isDemoMode()) {
      await ensureDemoShowcase();
    }
    const tenantPath = ensureTenantDirectories(tenant);
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
  } catch {
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
