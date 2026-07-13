import { NextRequest, NextResponse } from 'next/server';
import { buildWarRoomSnapshot, executeRecoveryAction } from '@/lib/operations';
import { isDemoMode } from '@/lib/runtimeMode';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenant = await getTenantId();
    return NextResponse.json(await buildWarRoomSnapshot(tenant));
  } catch (error) {
    console.error('[war-room] failed to build snapshot', error);
    return NextResponse.json({ error: 'Failed to load War Room' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({ error: 'War Room recovery actions are disabled in public demo mode.' }, { status: 403 });
  }
  try {
    const tenant = await getTenantId();
    const body = await request.json();
    const allowed = new Set(['acknowledge', 'resolve', 'retry_run', 'requeue_task', 'recheck']);
    if (!allowed.has(body.action)) {
      return NextResponse.json({ error: 'Unsupported recovery action.' }, { status: 400 });
    }
    const snapshot = await executeRecoveryAction(tenant, {
      action: body.action,
      incident_id: body.incident_id ? Number(body.incident_id) : undefined,
      target_id: body.target_id ? Number(body.target_id) : undefined,
      requested_by: typeof body.requested_by === 'string' ? body.requested_by : 'founder',
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recovery action failed';
    console.error('[war-room] recovery action failed', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
