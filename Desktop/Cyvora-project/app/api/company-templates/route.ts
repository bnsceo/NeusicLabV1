import { NextResponse } from 'next/server';
import { getCompanyTemplates } from '@/lib/companyEngine';

export async function GET() {
  const templates = getCompanyTemplates().map((template) => ({
    id: template.id,
    version: template.version,
    category: template.category,
    name: template.name,
    summary: template.summary,
    description: template.description,
    brandColor: template.brandColor,
    lifecycle: template.lifecycle,
    departmentCount: template.blueprint.departments.length,
    agentCount: template.blueprint.departments.reduce((total, department) => total + department.teams.reduce((teamTotal, team) => teamTotal + team.agents.length, 0), 0),
    taskCount: template.blueprint.tasks.length,
    connectorCount: template.blueprint.connectors.length,
    estimatedMonthlyCost: 0,
  }));
  return NextResponse.json({ templates, cost_usd: 0, provider: 'mock' });
}
