import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getExecutionRunById, updateExecutionRun, updateMissionStatus, saveActivityEvent } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number.parseInt(rawId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
    }

    const tenant = await getTenantId();
    const run = await getExecutionRunById(id, tenant);
    if (!run) {
      return NextResponse.json({ error: 'Execution run not found' }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch {
    return NextResponse.json({ error: 'Failed to load execution run' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action, reason } = await req.json();
    const { id: rawId } = await params;
    const id = Number.parseInt(rawId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
    }
    if (action !== 'rollback') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const tenant = await getTenantId();
    const run = await getExecutionRunById(id, tenant);
    if (!run) {
      return NextResponse.json({ error: 'Execution run not found' }, { status: 404 });
    }
    if (run.status === 'rolled_back') {
      return NextResponse.json({ error: 'Run is already rolled back' }, { status: 409 });
    }

    await updateExecutionRun({
      id,
      status: 'rolled_back',
      rollback_state: 'completed',
      error_message: reason || 'Rolled back by founder',
      mission_id: run.mission_id || undefined,
      company_id: run.company_id || undefined,
      completed: true,
    });

    if (run.mission_id) {
      await updateMissionStatus(run.mission_id, 'abandoned');
    }

    if (run.company_id) {
      await saveActivityEvent({
        company_id: run.company_id,
        event_type: 'execution_rolled_back',
        title: `Execution run #${id} rolled back`,
        description: reason || 'Founder requested rollback from the execution control panel.',
      });
    }

    const updated = await getExecutionRunById(id, tenant);
    return NextResponse.json(updated || { id, status: 'rolled_back' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to rollback execution' }, { status: 500 });
  }
}
