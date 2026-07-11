import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { sendSSEEvent } from '../stream/route';
import { ensureTenantDirectories, getTenantId } from '@/lib/tenant';
import {
  saveActivityEvent,
  saveApproval,
  saveConnector,
  saveCompany,
  saveDepartment,
  saveMission,
  saveOutput,
  saveTask,
  saveTeam,
  saveAgentAssignment,
  saveExecutionRun,
  updateExecutionRun,
} from '@/lib/db';
import { backendRoot, workspaceRoot } from '@/lib/paths';
import { inferMissionBlueprint } from '@/lib/missionBlueprint';
import { getRuntimeModeInfo, shouldUseMockMode, isDemoMode } from '@/lib/runtimeMode';
import { loadHarnessApprovalSnapshot } from '@/lib/harnessApproval';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { goal, harness_request_id, runtime_plan } = await req.json();
    if (!harness_request_id) {
      return NextResponse.json(
        { error: 'An approved Harness Engineering request is required before execution can start' },
        { status: 400 }
      );
    }
    if (!goal) {
      return NextResponse.json({ error: 'Goal is required' }, { status: 400 });
    }
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Execution is read-only in free demo mode. Reset the demo to refresh showcase data.' },
        { status: 403 }
      );
    }

    const tenant = await getTenantId();
    const tenantPath = ensureTenantDirectories(tenant);
    const runtimeMode = getRuntimeModeInfo();
    const requestedId = Number.parseInt(String(harness_request_id), 10);
    if (Number.isNaN(requestedId)) {
      return NextResponse.json({ error: 'Invalid harness request id' }, { status: 400 });
    }

    const approvedRequestSnapshot = loadHarnessApprovalSnapshot(tenant, requestedId);
    if (!approvedRequestSnapshot) {
      return NextResponse.json(
        { error: 'The selected request has not been approved with a saved runtime plan' },
        { status: 403 }
      );
    }

    if (approvedRequestSnapshot.approval_state !== 'approved') {
      return NextResponse.json({ error: 'The selected request is not approved for execution' }, { status: 403 });
    }

    if (approvedRequestSnapshot.request.trim() !== goal.trim()) {
      return NextResponse.json(
        { error: 'Execution goal must match the approved Harness Engineering request' },
        { status: 409 }
      );
    }

    if (JSON.stringify(runtime_plan) !== JSON.stringify(approvedRequestSnapshot.runtime_plan)) {
      return NextResponse.json(
        { error: 'Runtime plan does not match the approved snapshot' },
        { status: 409 }
      );
    }

    const executionRunId = await saveExecutionRun({
      tenant,
      request_id: requestedId,
      goal: approvedRequestSnapshot.request,
      runtime_plan: approvedRequestSnapshot.runtime_plan,
      runtime_mode: runtimeMode.mode,
      status: 'running',
      rollback_state: 'ready',
      paid_ai: runtimeMode.allowPaidAI,
      mock_mode: runtimeMode.mockMode,
    });

    const projectRoot = workspaceRoot;
    const scriptPath = path.join(backendRoot, 'app', 'agents', 'orchestrator', 'supervisor_router.py');

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: 'Supervisor script not found' }, { status: 404 });
    }

    sendSSEEvent({ type: 'start', message: '🚀 Mission started', goal });

    const pythonProcess = spawn('python3', [scriptPath, goal], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        // Local synthetic results are the safe default. Paid OpenRouter calls
        // require an explicit operator opt-in.
        MOCK_MODE: shouldUseMockMode() ? 'true' : 'false',
      },
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
          const rootBriefing = path.join(projectRoot, 'mission_briefing.md');
          const tenantBriefing = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'mission_briefing.md');
          const rootStatus = path.join(projectRoot, 'mission_status.json');
          const tenantStatus = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'status.json');

          if (fs.existsSync(rootBriefing)) {
            fs.copyFileSync(rootBriefing, tenantBriefing);
          }
          if (fs.existsSync(rootStatus)) {
            fs.copyFileSync(rootStatus, tenantStatus);
          }

          let content = '';
          try {
            content = fs.readFileSync(tenantBriefing, 'utf-8');
          } catch {
            content = 'No briefing generated.';
          }

          const briefing = parseBriefing(content);
          let status = 'pending';
          try {
            const statusData = JSON.parse(fs.readFileSync(tenantStatus, 'utf-8'));
            status = statusData.status;
          } catch {}

          // Save to history database and write mission ID file
          let missionId = null;
          try {
            missionId = await saveMission({
              objective: briefing.objective,
              agents: briefing.agents,
              status: status,
              timestamp: new Date().toISOString(),
              briefing_file: tenantBriefing,
            });
            // Write the mission ID to a file so the approve route can find it
            const idPath = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'mission_id.json');
            fs.writeFileSync(idPath, JSON.stringify({ id: missionId }));
              briefing.id = missionId;
            } catch (dbError) {
              console.error('Failed to save mission to history:', dbError);
            }

            let companyId: number | null = null;
            try {
              companyId = await seedMissionOrganization({
                tenant,
                objective: briefing.objective || goal,
                briefing,
              });
            } catch (orgError) {
              console.error('Failed to seed mission organization:', orgError);
            }

          briefing.status = status;
          sendSSEEvent({ type: 'done', briefing });
          await updateExecutionRun({
            id: executionRunId,
            status: 'completed',
            rollback_state: 'ready',
            mission_id: missionId || undefined,
            company_id: companyId || undefined,
            completed: true,
          });
          resolve(
            NextResponse.json({
              success: true,
              briefing,
              id: missionId,
              company_id: companyId,
              runtime_mode: runtimeMode.mode,
              paid_ai: runtimeMode.allowPaidAI,
              mock_mode: runtimeMode.mockMode,
              harness_request_id: requestedId,
              execution_run_id: executionRunId,
            })
          );
        } else {
          sendSSEEvent({ type: 'error', message: `Process exited with code ${code}` });
          await updateExecutionRun({
            id: executionRunId,
            status: 'failed',
            rollback_state: 'required',
            error_message: `Process exited with code ${code}`,
            completed: true,
          });
          resolve(NextResponse.json({ error: 'Mission failed' }, { status: 500 }));
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseBriefing(content: string): {
  id?: number;
  objective: string;
  agents: { name: string; task: string; output: string }[];
  status: string;
  timestamp: string;
} {
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

async function seedMissionOrganization({
  tenant,
  objective,
  briefing,
}: {
  tenant: string;
  objective: string;
  briefing: {
    objective: string;
    agents: { name: string; task: string; output: string }[];
  };
}): Promise<number> {
  const blueprint = inferMissionBlueprint(objective);
  const companyId = await saveCompany({
    tenant,
    name: blueprint.companyName,
    description: `${blueprint.description} Seeded from: ${objective}`,
    brand_color: blueprint.brandColor,
  });

  const createdDepartments: Array<{ id: number; name: string; teams: Array<{ id: number; name: string; agents: any[] }> }> = [];

  for (const departmentSpec of blueprint.departments) {
    const departmentId = await saveDepartment({
      company_id: companyId,
      name: departmentSpec.name,
      description: departmentSpec.description,
    });

    const createdTeams: Array<{ id: number; name: string; agents: any[] }> = [];

    for (const teamSpec of departmentSpec.teams) {
      const teamId = await saveTeam({
        department_id: departmentId,
        name: teamSpec.name,
        description: teamSpec.description,
      });

      const createdAgents: any[] = [];
      for (const agentSpec of teamSpec.agents) {
        const agentId = await saveAgentAssignment({
          team_id: teamId,
          agent_name: agentSpec.name,
          task_type: agentSpec.taskType,
        });
        createdAgents.push({ id: agentId, name: agentSpec.name });
      }

      createdTeams.push({ id: teamId, name: teamSpec.name, agents: createdAgents });
    }

    createdDepartments.push({ id: departmentId, name: departmentSpec.name, teams: createdTeams });
  }

  for (const [index, connector] of blueprint.connectorDetails.entries()) {
    const department = createdDepartments[index % createdDepartments.length];
    const team = department?.teams[0];
    await saveConnector({
      company_id: companyId,
      department_id: department?.id,
      team_id: team?.id,
      name: connector.name,
      connector_type: connector.connectorType,
      status: connector.status,
      summary: connector.summary,
    });
  }

  const departmentForTask = createdDepartments[0];
  const teamForTask = departmentForTask?.teams[0];
  const agentForTask = teamForTask?.agents[0];

  const taskId = await saveTask({
    company_id: companyId,
    department_id: departmentForTask?.id,
    team_id: teamForTask?.id,
    title: `${blueprint.companyName}: launch from objective`,
    description: `Seeded company generated from mission objective: ${objective}`,
    workflow_stage: 'Initiation',
    status: 'active',
    priority: 'high',
    assigned_agent: agentForTask?.name || briefing.agents[0]?.name || 'Executive AI',
  });

  await saveOutput({
    company_id: companyId,
    task_id: taskId,
    title: `${blueprint.companyName} launch brief`,
    output_type: 'brief',
    status: 'drafting',
    summary: `Generated from mission objective: ${objective}`,
  });

  await saveApproval({
    company_id: companyId,
    task_id: taskId,
    title: `Approve ${blueprint.companyName} launch`,
    summary: 'Founder approval is required before execution expands beyond the starter structure.',
    status: 'pending',
    risk_level: 'medium',
  });

  await saveActivityEvent({
    company_id: companyId,
    event_type: 'mission_seeded',
    title: `${blueprint.companyName} created from mission objective`,
    description: `${blueprint.departments.length} departments, ${blueprint.connectors.length} connectors, and a starter task were seeded from the launch.`,
  });

  return companyId;
}
