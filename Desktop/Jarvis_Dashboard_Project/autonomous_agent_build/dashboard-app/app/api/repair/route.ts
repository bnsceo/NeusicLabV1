import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { sendSSEEvent } from '../stream/route';
import { ensureTenantDirectories, getTenantId } from '@/lib/tenant';
import { backendRoot, workspaceRoot } from '@/lib/paths';
import { getRuntimeModeInfo, shouldUseMockMode } from '@/lib/runtimeMode';

const SECURITY_KEYWORDS = ['breach', 'intrusion', 'malware', 'unauthorized', 'vulnerability', 'exploit', 'ransomware', 'phishing', 'compromise'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { alert } = await req.json();
    if (!alert) {
      return NextResponse.json({ error: 'Alert description is required' }, { status: 400 });
    }

    const tenant = await getTenantId();
    const tenantPath = ensureTenantDirectories(tenant);
    const runtimeMode = getRuntimeModeInfo();

    const projectRoot = workspaceRoot;

    const isSecurity = SECURITY_KEYWORDS.some(keyword => alert.toLowerCase().includes(keyword));
    let scriptPath;
    let goal = alert;
    if (isSecurity) {
      scriptPath = path.join(backendRoot, 'app', 'agents', 'orchestrator', 'supervisor_router.py');
      goal = `Investigate the following security incident and provide a detailed report with remediation steps: ${alert}`;
      sendSSEEvent({ type: 'start', message: '🛡️ Security Supervisor engaged', alert });
    } else {
      scriptPath = path.join(backendRoot, 'app', 'agents', 'orchestrator', 'war_room_monitor.py');
      sendSSEEvent({ type: 'start', message: '🛡️ War Room engaged', alert });
    }

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: 'Agent script not found' }, { status: 404 });
    }

    // war_room_monitor.py does not provide a local mock implementation, so
    // return a deterministic repair briefing without starting an API client.
    const mockMode = shouldUseMockMode();

    if (mockMode && !isSecurity) {
      const content = [
        '# Repair Briefing',
        '',
        `**Incident:** ${alert}`,
        '',
        '**Investigation:**',
        'Free-mode simulation completed. Review application logs, reproduce the failure locally, and validate a proposed repair before deployment.',
        '',
        '---',
        '**Please review and DECREE or ABANDON.**',
      ].join('\n');
      const destBriefing = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'repair_briefing.md');
      fs.writeFileSync(destBriefing, content);
      const briefing = { objective: alert, content };
      sendSSEEvent({ type: 'done', briefing });
      return NextResponse.json({ success: true, briefing, security: false, freeMode: true });
    }

    const env = { ...process.env, MOCK_MODE: mockMode ? 'true' : 'false' };
    const pythonProcess = spawn('python3', [scriptPath, goal], {
      cwd: projectRoot,
      env: { ...env, PYTHONUNBUFFERED: '1' },
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

    return new Promise<NextResponse>((resolve) => {
      pythonProcess.on('close', async (code) => {
        if (code === 0) {
          let sourceBriefing, destBriefing;
          if (isSecurity) {
            sourceBriefing = path.join(projectRoot, 'mission_briefing.md');
            destBriefing = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'mission_briefing.md');
          } else {
            sourceBriefing = path.join(projectRoot, 'repair_briefing.md');
            destBriefing = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'repair_briefing.md');
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
          resolve(
            NextResponse.json({
              success: true,
              briefing,
              security: isSecurity,
              runtime_mode: runtimeMode.mode,
              mock_mode: runtimeMode.mockMode,
            })
          );
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
