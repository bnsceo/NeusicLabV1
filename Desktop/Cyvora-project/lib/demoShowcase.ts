import fs from 'fs';
import path from 'path';
import { buildHarnessPlan } from './harnessPlan';
import {
  clearDemoMissions,
  clearDemoTenantData,
  getCompanies,
  getExecutionRuns,
  getSelfCodingRequests,
  saveApproval,
  saveActivityEvent,
  saveAgentAssignment,
  saveCompany,
  saveConnector,
  saveDepartment,
  saveExecutionRun,
  saveMission,
  saveOutput,
  saveSelfCodingRequest,
  saveTask,
  saveTeam,
} from './db';
import { ensureTenantDirectories } from './tenant';
import { saveHarnessApprovalSnapshot } from './harnessApproval';

const DEMO_TENANT = 'demo';

type SeedCompany = {
  name: string;
  description: string;
  brand_color: string;
  departments: {
    name: string;
    description: string;
    teams: {
      name: string;
      description: string;
      agents: { name: string; taskType: string }[];
    }[];
  }[];
  connectors: { name: string; connector_type: string; status: string; summary: string }[];
};

const demoCompanies: SeedCompany[] = [
  {
    name: 'Content Studio',
    description: 'A public demo studio for content planning, creative production, and growth.',
    brand_color: '#38bdf8',
    departments: [
      {
        name: 'Audience Research',
        description: 'Finds topics, demand, and audience language.',
        teams: [
          {
            name: 'Topic Intelligence',
            description: 'Tracks what the audience wants next.',
            agents: [
              { name: 'Product Trend Researcher', taskType: 'topic_research' },
              { name: 'UX Researcher', taskType: 'audience_research' },
            ],
          },
        ],
      },
      {
        name: 'Creative Production',
        description: 'Drafts scripts, visuals, and packaging.',
        teams: [
          {
            name: 'Editorial',
            description: 'Shapes the message and release plan.',
            agents: [
              { name: 'Copywriter', taskType: 'scriptwriting' },
              { name: 'Visual Storyteller', taskType: 'visual_direction' },
            ],
          },
        ],
      },
    ],
    connectors: [
      { name: 'YouTube Studio', connector_type: 'platform', status: 'linked', summary: 'Publishing and analytics surface.' },
      { name: 'Asset Library', connector_type: 'storage', status: 'ready', summary: 'Source assets and packaged media.' },
      { name: 'Publishing Queue', connector_type: 'workflow', status: 'queued', summary: 'Release orchestration for new episodes.' },
    ],
  },
  {
    name: 'Software Lab',
    description: 'A demo product org for building dashboards, systems, and workflows.',
    brand_color: '#6366f1',
    departments: [
      {
        name: 'Product Strategy',
        description: 'Turns the vision into requirements and milestones.',
        teams: [
          {
            name: 'Discovery',
            description: 'Defines scope and delivery shape.',
            agents: [
              { name: 'Product Manager', taskType: 'product_strategy' },
              { name: 'UX Architect', taskType: 'ux_architecture' },
            ],
          },
        ],
      },
      {
        name: 'Engineering',
        description: 'Builds the interface and backend systems.',
        teams: [
          {
            name: 'Application Build',
            description: 'Ships the product in safe increments.',
            agents: [
              { name: 'Frontend Developer', taskType: 'frontend' },
              { name: 'Backend Architect', taskType: 'backend' },
              { name: 'Database Optimizer', taskType: 'database' },
            ],
          },
        ],
      },
    ],
    connectors: [
      { name: 'GitHub', connector_type: 'source control', status: 'linked', summary: 'Codebase and pull request coordination.' },
      { name: 'Issue Tracker', connector_type: 'workflow', status: 'ready', summary: 'Planning and execution board for engineering work.' },
      { name: 'SQLite Ledger', connector_type: 'data', status: 'ready', summary: 'Operational data and generated records.' },
    ],
  },
];

export async function ensureDemoShowcase(): Promise<void> {
  const tenantPath = ensureTenantDirectories(DEMO_TENANT);
  const companies = await getCompanies(DEMO_TENANT);
  const requests = await getSelfCodingRequests(DEMO_TENANT);
  const runs = await getExecutionRuns(DEMO_TENANT);
  const briefingPath = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'mission_briefing.md');
  const hasBriefing = fs.existsSync(briefingPath);
  if (companies.length > 0 && requests.length > 0 && runs.length > 0 && hasBriefing) return;
  await resetDemoShowcase();
}

export async function resetDemoShowcase(): Promise<void> {
  const tenantPath = ensureTenantDirectories(DEMO_TENANT);
  await clearDemoTenantData(DEMO_TENANT);
  await clearDemoMissions();

  const demoMissionObjective = '[DEMO] Launch a content studio and software lab showcase';
  const briefing = [
    '**Objective:** Launch a content studio and software lab showcase',
    '',
    '## Agent: Product Trend Researcher',
    '**Task:** Validate demand for the demo showcase and observe mobile workflow responsiveness.',
    '',
    '## Agent: Frontend Developer',
    '**Task:** Keep the dashboard legible on phones while preserving the control surfaces.',
    '',
  ].join('\n');

  const briefingPath = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'mission_briefing.md');
  const statusPath = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'status.json');
  const missionIdPath = path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', 'mission_id.json');
  fs.writeFileSync(briefingPath, briefing);
  fs.writeFileSync(statusPath, JSON.stringify({ status: 'approved', objective: demoMissionObjective, timestamp: new Date().toISOString() }, null, 2));

  const missionId = await saveMission({
    objective: demoMissionObjective,
    agents: [
      { name: 'Product Trend Researcher', task: 'Validate demand for the demo showcase and observe mobile workflow responsiveness.', output: '' },
      { name: 'Frontend Developer', task: 'Keep the dashboard legible on phones while preserving the control surfaces.', output: '' },
    ],
    status: 'approved',
    timestamp: new Date().toISOString(),
    briefing_file: briefingPath,
  });
  fs.writeFileSync(missionIdPath, JSON.stringify({ id: missionId }, null, 2));

  let firstCompanyId: number | null = null;

  for (const companySpec of demoCompanies) {
    const companyId = await saveCompany({
      tenant: DEMO_TENANT,
      name: companySpec.name,
      description: companySpec.description,
      brand_color: companySpec.brand_color,
    });
    if (companySpec === demoCompanies[0]) {
      firstCompanyId = companyId;
    }

    const departments: Array<{ id: number; name: string; teams: Array<{ id: number; agents: { id: number; name: string }[] }> }> = [];
    for (const departmentSpec of companySpec.departments) {
      const departmentId = await saveDepartment({
        company_id: companyId,
        name: departmentSpec.name,
        description: departmentSpec.description,
      });

      const teams: Array<{ id: number; agents: { id: number; name: string }[] }> = [];
      for (const teamSpec of departmentSpec.teams) {
        const teamId = await saveTeam({
          department_id: departmentId,
          name: teamSpec.name,
          description: teamSpec.description,
        });

        const agents: { id: number; name: string }[] = [];
        for (const agentSpec of teamSpec.agents) {
          const agentId = await saveAgentAssignment({
            team_id: teamId,
            agent_name: agentSpec.name,
            task_type: agentSpec.taskType,
          });
          agents.push({ id: agentId, name: agentSpec.name });
        }
        teams.push({ id: teamId, agents });
      }
      departments.push({ id: departmentId, name: departmentSpec.name, teams });
    }

    for (const [index, connector] of companySpec.connectors.entries()) {
      const department = departments[index % departments.length];
      const team = department?.teams[0];
      await saveConnector({
        company_id: companyId,
        department_id: department?.id,
        team_id: team?.id,
        name: connector.name,
        connector_type: connector.connector_type,
        status: connector.status,
        summary: connector.summary,
      });
    }

    const firstDepartment = departments[0];
    const firstTeam = firstDepartment?.teams[0];
    const firstAgent = firstTeam?.agents[0];
    const taskId = await saveTask({
      company_id: companyId,
      department_id: firstDepartment?.id,
      team_id: firstTeam?.id,
      title: `${companySpec.name}: launch from objective`,
      description: `Demo company seeded from the public showcase reset.`,
      workflow_stage: 'Initiation',
      status: 'active',
      priority: 'high',
      assigned_agent: firstAgent?.name || 'Executive AI',
    });

    await saveOutput({
      company_id: companyId,
      task_id: taskId,
      title: `${companySpec.name} launch brief`,
      output_type: 'brief',
      status: 'drafting',
      summary: `Generated for the public demo showcase.`,
    });

    await saveApproval({
      company_id: companyId,
      task_id: taskId,
      title: `Approve ${companySpec.name} demo launch`,
      summary: 'Demo launch is pre-approved for showcase purposes.',
      status: 'approved',
      risk_level: 'low',
    });

    await saveActivityEvent({
      company_id: companyId,
      event_type: 'demo_seeded',
      title: `${companySpec.name} seeded`,
      description: 'Public demo showcase data was reset and re-seeded.',
    });
  }

  const requestId = await saveSelfCodingRequest({
    tenant: DEMO_TENANT,
    request: 'Build a mobile-first content dashboard with local demo mode.',
    status: 'approved_for_build',
    stage: 'BUILD',
    approval_state: 'approved',
    assigned_agents: [
      { name: 'Software Architect', role: 'Maps the change to the existing app structure' },
      { name: 'Frontend Developer', role: 'Builds React screens and polished UI states' },
      { name: 'Security Auditor', role: 'Checks permissions, secrets, and risky operations' },
    ],
    qa_confidence: 94,
    qa_summary: 'Demo request pre-approved for showcase flow.',
    dissent: 'None. Showcase data is seeded and read-only.',
  });

  const requestText = 'Build a mobile-first content dashboard with local demo mode.';
  const runtimePlan = buildHarnessPlan(requestText);
  saveHarnessApprovalSnapshot({
    request_id: requestId,
    tenant: DEMO_TENANT,
    request: requestText,
    approval_state: 'approved',
    runtime_plan: runtimePlan,
    approved_at: new Date().toISOString(),
    approval_stage: 'BUILD',
  });

  await saveExecutionRun({
    tenant: DEMO_TENANT,
    request_id: requestId,
    mission_id: missionId,
    company_id: firstCompanyId || undefined,
    goal: requestText,
    runtime_plan: runtimePlan,
    runtime_mode: 'demo',
    status: 'completed',
    rollback_state: 'ready',
    paid_ai: false,
    mock_mode: true,
  });
}
