import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import {
  getActivityEvents,
  getAgentAssignments,
  getApprovals,
  getCompanies,
  getConnectors,
  getDepartments,
  getTasks,
  getTeams,
} from '@/lib/db';
import { ensureDemoShowcase } from '@/lib/demoShowcase';
import { isDemoMode } from '@/lib/runtimeMode';

export async function GET() {
  try {
    const tenant = await getTenantId();
    if (isDemoMode()) {
      await ensureDemoShowcase();
    }
    const companies = await getCompanies(tenant);

    const organization = await Promise.all(
      companies.map(async (company: any) => {
        const departments = await getDepartments(company.id);
        const connectors = await getConnectors(company.id);
        const tasks = await getTasks(company.id);
        const approvals = await getApprovals(company.id);
        const nestedDepartments = await Promise.all(
          departments.map(async (department: any) => {
            const teams = await getTeams(department.id);
            const nestedTeams = await Promise.all(
              teams.map(async (team: any) => {
                const agents = await getAgentAssignments(team.id);
                return { ...team, agents };
              })
            );
            return { ...department, teams: nestedTeams };
          })
        );

        return { ...company, connectors, tasks, approvals, departments: nestedDepartments };
      })
    );

    const totals = organization.reduce(
      (acc, company: any) => {
        acc.companies += 1;
        acc.tasks += company.tasks.length;
        acc.connectors += company.connectors.length;
        acc.approvals += company.approvals.filter((approval: any) => approval.status === 'pending').length;
        acc.departments += company.departments.length;
        for (const department of company.departments) {
          acc.teams += department.teams.length;
          for (const team of department.teams) {
            acc.agents += team.agents.length;
          }
        }
        return acc;
      },
      { companies: 0, departments: 0, teams: 0, agents: 0, tasks: 0, approvals: 0, connectors: 0 }
    );

    return NextResponse.json({
      tenant,
      executive_ai: {
        name: 'Executive AI',
        role: 'Autonomous CEO and operating intelligence',
        status: 'online',
      },
      totals,
      activity: await getActivityEvents(),
      companies: organization,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load Headquarters' }, { status: 500 });
  }
}
