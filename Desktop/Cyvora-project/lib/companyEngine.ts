import {
  saveActivityEvent,
  saveAgentAssignment,
  saveApproval,
  saveCompany,
  saveConnector,
  saveDepartment,
  saveOutput,
  saveTask,
  saveTeam,
} from '@/lib/db';
import { buildExecutiveBlueprint, type ExecutiveBlueprint } from '@/lib/executiveBlueprint';

export type CompanyLifecycle = 'draft' | 'planning' | 'active' | 'scaling' | 'paused' | 'archived';

export type CompanyTemplate = {
  id: string;
  version: string;
  category: string;
  name: string;
  summary: string;
  description: string;
  brandColor: string;
  lifecycle: CompanyLifecycle;
  objectiveSeed: string;
  blueprint: ExecutiveBlueprint;
  workflows: { name: string; stages: string[]; owner: string }[];
  policies: { name: string; rule: string; approvalRequired: boolean }[];
  sops: { name: string; purpose: string }[];
  dashboardWidgets: string[];
};

const TEMPLATE_SEEDS = [
  { id: 'content-studio', category: 'content', objective: 'Create a content studio for audience research, production, publishing, and analytics.' },
  { id: 'software-lab', category: 'software', objective: 'Create a software lab for product strategy, design, engineering, quality, and deployment.' },
  { id: 'marketplace-division', category: 'marketplace', objective: 'Create a marketplace division for research, products, listings, marketing, and support.' },
  { id: 'investment-company', category: 'investment', objective: 'Create an investment company for research, portfolio intelligence, compliance, risk, finance, operations, and legal.' },
  { id: 'consulting-group', category: 'consulting', objective: 'Create a consulting group for strategy, sales, client delivery, and reporting.' },
] as const;

function buildTemplate(seed: (typeof TEMPLATE_SEEDS)[number]): CompanyTemplate {
  const blueprint = buildExecutiveBlueprint(seed.objective);
  const workflows = Array.from(new Set(blueprint.tasks.map((task) => task.stage))).map((stage) => ({
    name: `${stage} workflow`,
    stages: blueprint.tasks.filter((task) => task.stage === stage).map((task) => task.title),
    owner: blueprint.tasks.find((task) => task.stage === stage)?.owner || 'Executive AI',
  }));
  return {
    id: seed.id,
    version: '1.0.0',
    category: seed.category,
    name: blueprint.company.name,
    summary: blueprint.executiveSummary,
    description: blueprint.company.description,
    brandColor: blueprint.company.brandColor,
    lifecycle: 'draft',
    objectiveSeed: seed.objective,
    blueprint,
    workflows,
    policies: blueprint.approvals.map((approval) => ({
      name: approval.title,
      rule: approval.reason,
      approvalRequired: true,
    })),
    sops: blueprint.roadmap.flatMap((phase) => phase.outputs.map((output) => ({
      name: output,
      purpose: `${phase.phase}: ${phase.objective}`,
    }))),
    dashboardWidgets: ['Company health', 'Task queue', 'Approval queue', 'Outputs', 'KPIs', 'Runtime cost'],
  };
}

const templates = TEMPLATE_SEEDS.map(buildTemplate);

export function getCompanyTemplates(): CompanyTemplate[] {
  return templates.map((template) => structuredClone(template));
}

export function getCompanyTemplate(id: string): CompanyTemplate | null {
  const template = templates.find((item) => item.id === id);
  return template ? structuredClone(template) : null;
}

export async function instantiateCompanyTemplate(input: {
  templateId: string;
  tenant: string;
  objective?: string;
  companyName?: string;
}) {
  const template = getCompanyTemplate(input.templateId);
  if (!template) throw new Error(`Unknown company template: ${input.templateId}`);

  const objective = input.objective?.trim() || template.objectiveSeed;
  const blueprint = buildExecutiveBlueprint(objective);
  if (input.companyName?.trim()) blueprint.company.name = input.companyName.trim();

  const companyId = await saveCompany({
    tenant: input.tenant,
    name: blueprint.company.name,
    description: blueprint.company.description,
    brand_color: blueprint.company.brandColor,
  });

  const departmentIds = new Map<string, number>();
  const teamIds = new Map<string, number>();

  for (const department of blueprint.departments) {
    const departmentId = await saveDepartment({
      company_id: companyId,
      name: department.name,
      description: department.purpose,
    });
    departmentIds.set(department.name, departmentId);

    for (const team of department.teams) {
      const teamId = await saveTeam({
        department_id: departmentId,
        name: team.name,
        description: team.purpose,
      });
      teamIds.set(`${department.name}:${team.name}`, teamId);
      for (const member of team.agents) {
        await saveAgentAssignment({
          team_id: teamId,
          agent_name: member.name,
          task_type: member.taskType,
        });
      }
    }
  }

  for (const connector of blueprint.connectors) {
    await saveConnector({
      company_id: companyId,
      name: connector.name,
      connector_type: connector.purpose,
      status: 'mock-ready',
      summary: `${connector.purpose} Risk: ${connector.risk}.`,
    });
  }

  let firstTaskId: number | null = null;
  for (const task of blueprint.tasks) {
    const departmentId = departmentIds.get(task.department);
    const department = blueprint.departments.find((item) => item.name === task.department);
    const firstTeam = department?.teams[0];
    const teamId = firstTeam ? teamIds.get(`${task.department}:${firstTeam.name}`) : undefined;
    const taskId = await saveTask({
      company_id: companyId,
      department_id: departmentId,
      team_id: teamId,
      title: task.title,
      description: `Generated by Company Engine template ${template.id} v${template.version}.`,
      workflow_stage: task.stage,
      status: 'active',
      priority: task.priority,
      assigned_agent: task.owner,
      risk_level: task.priority,
      validation_policy: task.approvalRequired ? 'schema+founder' : 'schema',
      max_revisions: 2,
    });
    firstTaskId ??= taskId;
    if (task.approvalRequired) {
      await saveApproval({
        company_id: companyId,
        task_id: taskId,
        title: `Approve: ${task.title}`,
        summary: 'Company Engine approval gate generated from the template policy.',
        status: 'pending',
        risk_level: task.priority,
        approval_type: 'task_execution',
        subject_type: 'task',
        subject_id: taskId,
      });
    }
  }

  await saveOutput({
    company_id: companyId,
    task_id: firstTaskId || undefined,
    title: `${blueprint.company.name} operating blueprint`,
    output_type: 'company_blueprint',
    status: 'candidate',
    summary: JSON.stringify({
      template_id: template.id,
      template_version: template.version,
      objective,
      kpis: blueprint.kpis,
      roadmap: blueprint.roadmap,
      policies: template.policies,
    }, null, 2),
  });

  await saveActivityEvent({
    company_id: companyId,
    event_type: 'company_instantiated',
    title: `${blueprint.company.name} created from template`,
    description: `${template.id} v${template.version} · ${blueprint.departments.length} departments · $0 provider cost`,
  });

  return {
    companyId,
    templateId: template.id,
    templateVersion: template.version,
    blueprint,
  };
}
