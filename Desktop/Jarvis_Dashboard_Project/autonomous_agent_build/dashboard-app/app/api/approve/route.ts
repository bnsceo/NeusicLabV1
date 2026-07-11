import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ensureTenantDirectories } from '@/lib/tenant';
import { workspaceRoot } from '@/lib/paths';
import { updateMissionStatus } from '@/lib/db';
import { isDemoMode } from '@/lib/runtimeMode';

export async function POST(req: NextRequest) {
  try {
    const { action, objective } = await req.json();
    if (!action || !['decree', 'abandon'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Mission approval is read-only in free demo mode' },
        { status: 403 }
      );
    }

    const cookieStore = await req.cookies;
    const tenant = cookieStore.get('tenant')?.value || 'default';
    const tenantPath = ensureTenantDirectories(tenant);
    const briefingPath = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'mission_briefing.md');
    const statusPath = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'status.json');
    const idPath = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'mission_id.json');

    let content = '';
    try {
      content = fs.readFileSync(briefingPath, 'utf-8');
    } catch {
      return NextResponse.json({ error: 'No mission briefing found' }, { status: 404 });
    }

    const newStatus = action === 'decree' ? 'approved' : 'abandoned';

    // Update the status file
    const statusData = { status: newStatus, objective, timestamp: new Date().toISOString() };
    fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2));

    // Update the database status
    try {
      const idData = JSON.parse(fs.readFileSync(idPath, 'utf-8'));
      if (idData && idData.id) {
        await updateMissionStatus(idData.id, newStatus);
      }
    } catch (dbError) {
      console.warn('Failed to update database status:', dbError);
      // We continue anyway – status file is the source of truth for the UI
    }

    // Try git but don't block
    if (action === 'decree') {
      try {
        const { exec } = await import('child_process');
        const projectRoot = workspaceRoot;
        await exec('git add .', { cwd: projectRoot });
        await exec(`git commit -m "DECREED: ${objective.slice(0, 80)}"`, { cwd: projectRoot });
        await exec('git push', { cwd: projectRoot });
      } catch (gitError) {
        console.warn('Git failed, but status updated:', gitError);
      }
    }

    // Parse and return the briefing with updated status
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
