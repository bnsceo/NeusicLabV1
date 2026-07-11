import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getSelfCodingRequests, updateSelfCodingApproval } from '@/lib/db';
import { buildHarnessPlan } from '@/lib/harnessPlan';
import { clearHarnessApprovalSnapshot, saveHarnessApprovalSnapshot } from '@/lib/harnessApproval';
import { isDemoMode } from '@/lib/runtimeMode';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action, runtime_plan } = await req.json();
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'hold') {
      return NextResponse.json({ error: 'Action must be approve or hold' }, { status: 400 });
    }
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Harness Engineering approvals are disabled in free demo mode' },
        { status: 403 }
      );
    }

    const tenant = await getTenantId();
    const requests = await getSelfCodingRequests(tenant);
    const current = requests.find((item) => item.id === id);
    if (!current) {
      return NextResponse.json({ error: 'Harness Engineering request not found' }, { status: 404 });
    }

    const expectedPlan = buildHarnessPlan(current.request);
    if (action === 'approve') {
      if (!runtime_plan) {
        return NextResponse.json(
          { error: 'Runtime plan is required before approval' },
          { status: 400 }
        );
      }

      const incomingPlan = JSON.stringify(runtime_plan);
      const expectedPlanJson = JSON.stringify(expectedPlan);
      if (incomingPlan !== expectedPlanJson) {
        return NextResponse.json(
          { error: 'Runtime plan must match the server-generated harness plan' },
          { status: 409 }
        );
      }
    }

    await updateSelfCodingApproval({
      id,
      tenant,
      approval_state: action === 'approve' ? 'approved' : 'held',
      status: action === 'approve' ? 'approved_for_build' : 'changes_requested',
      stage: action === 'approve' ? 'BUILD' : 'PLAN',
    });

    if (action === 'approve') {
      saveHarnessApprovalSnapshot({
        request_id: id,
        tenant,
        request: current.request,
        approval_state: 'approved',
        runtime_plan: expectedPlan,
        approved_at: new Date().toISOString(),
        approval_stage: 'BUILD',
      });
    } else {
      clearHarnessApprovalSnapshot(tenant, id);
    }

    const updated = requests.find((item) => item.id === id);
    return NextResponse.json(updated ? { ...updated, runtime_plan: expectedPlan } : { id, runtime_plan: expectedPlan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update approval' }, { status: 500 });
  }
}
