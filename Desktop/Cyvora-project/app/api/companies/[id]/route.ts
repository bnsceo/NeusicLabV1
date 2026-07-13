import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { isDemoMode } from '@/lib/runtimeMode';
import {
  getActivityEvents,
  getAgentAssignments,
  getApprovals,
  getCompany,
  getDepartments,
  getConnectors,
  getOutputs,
  getTasks,
  getTeams,
  saveActivityEvent,
  saveApproval,
  saveConnector,
  saveOutput,
  saveTask,
} from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await getTenantId();
    const companyId = parseInt(id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    const company = await getCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (company.tenant !== tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const departments = await getDepartments(companyId);
    const existingConnectors = await getConnectors(companyId);
    const existingTasks = await getTasks(companyId);
    if (!isDemoMode() && existingConnectors.length === 0 && departments.length > 0) {
      await backfillConnectors(companyId, company.name, departments);
    }
    if (!isDemoMode() && existingTasks.length === 0 && departments.length > 0) {
      await backfillOperations(companyId, company.name, departments);
    }

    const result = {
      ...company,
      tasks: await getTasks(companyId),
      approvals: await getApprovals(companyId),
      outputs: await getOutputs(companyId),
      connectors: await getConnectors(companyId),
      activity: await getActivityEvents(companyId),
      departments: await Promise.all(departments.map(async (dept: any) => {
        const teams = await getTeams(dept.id);
        return {
          ...dept,
          teams: await Promise.all(teams.map(async (team: any) => {
            const agents = await getAgentAssignments(team.id);
            return {
              ...team,
              agents,
            };
          })),
        };
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/companies/[id]:', error);
    return NextResponse.json({ error: 'Failed to fetch company details' }, { status: 500 });
  }
}

async function backfillOperations(companyId: number, companyName: string, departments: any[]) {
  for (const dept of departments) {
    const teams = await getTeams(dept.id);
    const firstTeam = teams[0];
    const agents = firstTeam ? await getAgentAssignments(firstTeam.id) : [];
    const firstAgent = agents[0];
    const taskId = await saveTask({
      company_id: companyId,
      department_id: dept.id,
      team_id: firstTeam?.id,
      title: `${dept.name}: create first operating plan`,
      description: `Starter task generated for ${dept.name}.`,
      workflow_stage: stageForDepartment(dept.name),
      status: 'active',
      priority: 'high',
      assigned_agent: firstAgent?.agent_name || 'Executive AI',
    });
    await saveOutput({
      company_id: companyId,
      task_id: taskId,
      title: `${dept.name} starter brief`,
      output_type: 'brief',
      status: 'drafting',
      summary: `Initial output placeholder for ${dept.name}.`,
    });
  }

  await saveApproval({
    company_id: companyId,
    title: `Approve launch plan for ${companyName}`,
    summary: 'Founder approval required before this company moves from planning into execution.',
    status: 'pending',
    risk_level: 'medium',
  });
  await saveActivityEvent({
    company_id: companyId,
    event_type: 'operations_backfilled',
    title: 'Operating layer initialized',
    description: 'Starter tasks, outputs, and approval queue were created for this company.',
  });
}

async function backfillConnectors(companyId: number, companyName: string, departments: any[]) {
  for (const dept of departments) {
    const teams = await getTeams(dept.id);
    const team = teams[0];
    await saveConnector({
      company_id: companyId,
      department_id: dept.id,
      team_id: team?.id,
      name: `${dept.name} workspace`,
      connector_type: dept.name.toLowerCase().includes('research') ? 'data' : 'workflow',
      status: 'ready',
      summary: `${companyName} connector for ${dept.name.toLowerCase()} operations.`,
    });
  }
}

function stageForDepartment(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('research') || lower.includes('intelligence')) return 'Research';
  if (lower.includes('design') || lower.includes('creative') || lower.includes('product')) return 'Planning';
  if (lower.includes('engineering') || lower.includes('production')) return 'Generation';
  if (lower.includes('quality') || lower.includes('risk') || lower.includes('qa')) return 'Validation';
  if (lower.includes('growth') || lower.includes('marketing') || lower.includes('distribution')) return 'Publishing';
  return 'Analysis';
}
