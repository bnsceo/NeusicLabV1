import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getApprovalById, updateApprovalStatus, finalizeApprovedResult } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action } = await req.json();
    const { id: rawId } = await params;
    const id = Number.parseInt(rawId, 10);

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid approval id' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'hold') {
      return NextResponse.json({ error: 'Action must be approve or hold' }, { status: 400 });
    }

    const tenant = await getTenantId();
    const approval = await getApprovalById(id, tenant);
    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }
    const company = { id: approval.company_id };

    await updateApprovalStatus({
      id,
      company_id: company.id,
      status: action === 'approve' ? 'approved' : 'held',
    });

    if (action === 'approve' && approval.approval_type === 'result_acceptance') {
      await finalizeApprovedResult({
        approval_id: id,
        company_id: company.id,
        task_id: approval.task_id,
        output_id: approval.subject_id,
        execution_run_id: approval.execution_run_id,
      });
    }

    return NextResponse.json({
      id,
      company_id: company.id,
      status: action === 'approve' ? 'approved' : 'held',
      task_id: approval.task_id || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update approval' }, { status: 500 });
  }
}
