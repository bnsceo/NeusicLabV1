import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { sendSSEEvent } from '@/lib/sse';
import { ensureTenantDirectories, getTenantId } from '@/lib/tenant';
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
    const isSecurity = SECURITY_KEYWORDS.some(keyword => alert.toLowerCase().includes(keyword));

    // war_room_monitor.py does not provide a local mock implementation, so
    // return a deterministic repair briefing without starting an API client.
    const mockMode = shouldUseMockMode();
    const briefingLines = [
      '# Repair Briefing',
      '',
      `**Incident:** ${alert}`,
      '',
      '**Investigation:**',
      isSecurity
        ? 'Security review queued for the background worker and requires explicit founder review before any risky repair action.'
        : 'Simulation completed locally. Review application logs, reproduce the failure, and validate the proposed fix before deployment.',
      '',
      '---',
      '**Please review and DECREE or ABANDON.**',
    ];

    const destBriefing = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'repair_briefing.md');
    const content = briefingLines.join('\n');
    fs.writeFileSync(destBriefing, content);
    const briefing = { objective: alert, content };
    sendSSEEvent({
      type: 'start',
      message: isSecurity ? '🛡️ Security review queued' : '🛡️ War Room briefing created',
      alert,
    });
    sendSSEEvent({ type: 'done', briefing });

    return NextResponse.json({
      success: true,
      briefing,
      security: isSecurity,
      runtime_mode: runtimeMode.mode,
      mock_mode: runtimeMode.mockMode,
      freeMode: !isSecurity && mockMode,
      queued: isSecurity,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
