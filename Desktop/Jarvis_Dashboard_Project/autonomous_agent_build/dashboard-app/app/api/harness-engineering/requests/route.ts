import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getSelfCodingRequests, saveSelfCodingRequest } from '@/lib/db';
import { buildHarnessPlan } from '@/lib/harnessPlan';
import { isDemoMode } from '@/lib/runtimeMode';
import { ensureDemoShowcase } from '@/lib/demoShowcase';

const assignedAgents = [
  { name: 'Software Architect', role: 'Maps the change to the existing app structure' },
  { name: 'UX Architect', role: 'Defines the interaction model and progressive disclosure' },
  { name: 'Frontend Developer', role: 'Builds React screens and polished UI states' },
  { name: 'Backend Architect', role: 'Designs routes, persistence, and integrations' },
  { name: 'Database Optimizer', role: 'Reviews schema changes and history tracking' },
  { name: 'Security Auditor', role: 'Checks permissions, secrets, and risky operations' },
  { name: 'QA Board by duh', role: 'Runs consensus review before approval' },
  { name: 'DevOps Automator', role: 'Prepares branch, build, and deployment handoff' },
];

export async function GET() {
  try {
    const tenant = await getTenantId();
    if (isDemoMode()) {
      await ensureDemoShowcase();
    }
    const requests = await getSelfCodingRequests(tenant);
    return NextResponse.json(requests.map((request) => ({ ...request, runtime_plan: buildHarnessPlan(request.request) })));
  } catch {
    return NextResponse.json({ error: 'Failed to load Harness Engineering requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Harness Engineering writes are disabled in free demo mode' },
        { status: 403 }
      );
    }
    const { request } = await req.json();
    if (!request || !request.trim()) {
      return NextResponse.json({ error: 'Feature request is required' }, { status: 400 });
    }

    const tenant = await getTenantId();
    const confidence = request.toLowerCase().includes('deploy') ? 78 : 86;
    const id = await saveSelfCodingRequest({
      tenant,
      request: request.trim(),
      status: 'planning',
      stage: 'PLAN',
      approval_state: 'pending',
      assigned_agents: assignedAgents,
      qa_confidence: confidence,
      qa_summary: 'Initial AGENT-ZERO task contract generated. Specialist team assigned for review.',
      dissent: 'Require sandbox execution and visible diffs before allowing autonomous edits to become permanent.',
    });

    const requests = await getSelfCodingRequests(tenant);
    const created = requests.find((item) => item.id === id);
    return NextResponse.json(
      created
        ? { ...created, runtime_plan: buildHarnessPlan(created.request) }
        : { id, request: request.trim(), runtime_plan: buildHarnessPlan(request.trim()) },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create request' }, { status: 500 });
  }
}
