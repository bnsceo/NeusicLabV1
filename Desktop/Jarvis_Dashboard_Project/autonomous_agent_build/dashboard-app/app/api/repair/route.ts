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

    const cookieStore = await req.cookies;
    const tenant = cookieStore.get('tenant')?.value || 'default';
    const tenantPath = ensureTenantDirectories(tenant);

    const projectRoot = path.join(process.cwd(), '..');

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
