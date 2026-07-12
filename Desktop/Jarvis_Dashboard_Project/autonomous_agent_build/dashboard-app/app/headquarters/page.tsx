'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import CyvoraPageHeader from '@/components/CyvoraPageHeader';
import { clearDemoClientState, reloadFreshDemoPage } from '@/lib/demoClient';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';
import { buildShareableUrl, readNumericQueryParam } from '@/lib/viewState';

type Agent = {
  id: number;
  agent_name: string;
  task_type?: string;
};

type Team = {
  id: number;
  name: string;
  description?: string;
  agents: Agent[];
};

type Department = {
  id: number;
  name: string;
  description?: string;
  teams: Team[];
};

type Company = {
  id: number;
  name: string;
  description?: string;
  brand_color?: string;
  status?: string;
  departments: Department[];
};

type HeadquartersData = {
  tenant: string;
  executive_ai: {
    name: string;
    role: string;
    status: string;
  };
  totals: {
    companies: number;
    departments: number;
    teams: number;
    agents: number;
    tasks?: number;
    approvals?: number;
  };
  companies: Company[];
};

export default function HeadquartersPage() {
  const runtimeInfo = getRuntimeModeInfo();
  const isDemoModeActive = runtimeInfo.mode === 'demo';
  const [data, setData] = useState<HeadquartersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [urlHydrated, setUrlHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const companyId = readNumericQueryParam(window.location.search, 'company');
    if (companyId !== null) {
      setSelectedCompanyId(companyId);
    }
    setUrlHydrated(true);
  }, []);

  useEffect(() => {
    if (!urlHydrated || typeof window === 'undefined') return;
    const nextPath = buildShareableUrl(window.location.pathname, {
      company: selectedCompanyId,
    });
    const nextUrl = `${window.location.origin}${nextPath}`;
    setShareLink(nextUrl);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.replaceState(null, '', nextPath);
    }
  }, [selectedCompanyId, urlHydrated]);

  useEffect(() => {
    fetch('/api/headquarters')
      .then((res) => res.json())
      .then((payload) => {
        setData(payload);
        if (payload.companies?.length) {
          setSelectedCompanyId((current) => {
            if (current && payload.companies.some((company: Company) => company.id === current)) {
              return current;
            }
            return payload.companies[0].id;
          });
        }
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, []);

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) {
        alert(payload.error || 'Failed to reset demo showcase');
        return;
      }
      const refreshed = await fetch('/api/headquarters').then((res) => res.json());
      setData(refreshed);
      if (refreshed.companies?.length) {
        setSelectedCompanyId(refreshed.companies[0].id);
      }
      clearDemoClientState();
      reloadFreshDemoPage();
      alert('Demo showcase reset');
    } catch {
      alert('Failed to reset demo showcase');
    }
  };

  const selectedCompany = useMemo(() => {
    if (!data?.companies.length) return null;
    return data.companies.find((company) => company.id === selectedCompanyId) || data.companies[0];
  }, [data, selectedCompanyId]);

  const copyShareableLink = async () => {
    if (typeof window === 'undefined') return;
    const nextLink =
      shareLink ||
      `${window.location.origin}${buildShareableUrl(window.location.pathname, {
        company: selectedCompanyId,
      })}`;
    try {
      await navigator.clipboard.writeText(nextLink);
      alert('Company view link copied');
    } catch {
      alert(nextLink);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <NavBar />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <CyvoraPageHeader
          eyebrow="Headquarters View"
          title="Executive AI operating map"
          description="A living map of the autonomous organization: companies expand into departments, departments contain teams, and teams hold the agents doing the work."
        >
          <span className="cyvora-chip rounded-full px-3 py-1 text-xs text-cyan-100">
            {runtimeInfo.label}
          </span>
          <span className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-300">
            {isDemoModeActive ? 'Read-only demo' : 'Live organization'}
          </span>
          {isDemoModeActive ? (
            <button
              onClick={handleResetDemo}
              className="cyvora-chip rounded-xl px-4 py-2 text-sm text-slate-200 transition hover:translate-y-[-1px]"
            >
              Reset demo
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[520px]">
            <Stat label="Companies" value={data?.totals.companies ?? 0} />
            <Stat label="Departments" value={data?.totals.departments ?? 0} />
            <Stat label="Teams" value={data?.totals.teams ?? 0} />
            <Stat label="Agents" value={data?.totals.agents ?? 0} />
            <Stat label="Tasks" value={data?.totals.tasks ?? 0} />
            <Stat label="Approvals" value={data?.totals.approvals ?? 0} />
          </div>
        </CyvoraPageHeader>

        {loading ? (
          <div className="mt-6 cyvora-glass rounded-2xl p-6 text-slate-400">
            Loading Headquarters...
          </div>
        ) : !data || data.companies.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
            <aside className="cyvora-glass rounded-2xl p-5">
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300 text-sm font-bold text-slate-950">
                    AI
                  </div>
                  <div>
                    <h2 className="font-semibold">{data.executive_ai.name}</h2>
                    <p className="text-xs text-cyan-100/80">{data.executive_ai.role}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
                  {data.executive_ai.status}
                </div>
              </div>

              <div className="mt-5 flex gap-3 overflow-x-auto pb-1 xl:block xl:space-y-3 xl:overflow-visible xl:pb-0">
                {data.companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => setSelectedCompanyId(company.id)}
                    className={`cyvora-tactile min-w-[220px] rounded-xl p-4 text-left transition xl:w-full ${
                      selectedCompany?.id === company.id
                        ? 'border-cyan-300/50 bg-cyan-300/10'
                        : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-lg"
                        style={{ backgroundColor: company.brand_color || '#38bdf8' }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{company.name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {company.departments.length} departments
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={copyShareableLink}
                className="cyvora-chip mt-4 rounded-xl px-4 py-2 text-sm text-slate-200 transition hover:translate-y-[-1px]"
              >
                Copy selected company link
              </button>

              <div className="mt-4 cyvora-tactile rounded-2xl p-4 text-sm text-slate-100 md:hidden">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-200">Phone view</p>
                <p className="mt-1 font-medium">{selectedCompany?.name || 'No company selected'}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {selectedCompany?.departments.length || 0} departments · {countTeams(selectedCompany?.departments)} teams ·{' '}
                  {countAgents(selectedCompany?.departments)} agents
                </p>
              </div>
            </aside>

            {selectedCompany && <OrganizationMap company={selectedCompany} isDemoModeActive={isDemoModeActive} />}
          </section>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 cyvora-glass rounded-2xl p-8 text-center">
      <h2 className="text-[20px] font-semibold">No companies in Headquarters yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
        Create a business vision first. The Executive AI will turn it into companies,
        departments, teams, and agents.
      </p>
      <Link
        href="/companies"
        className="mt-5 inline-flex rounded-xl bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
      >
        Create company
      </Link>
    </div>
  );
}

function OrganizationMap({ company, isDemoModeActive }: { company: Company; isDemoModeActive: boolean }) {
  return (
    <div className="cyvora-glass rounded-2xl p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-400">Selected company</p>
          <h2 className="mt-1 text-[20px] font-semibold">{company.name}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{company.description}</p>
        </div>
        <Link
          href={`/companies/${company.id}`}
          className="cyvora-chip rounded-xl px-4 py-2 text-sm text-slate-200 transition hover:translate-y-[-1px]"
        >
          Open dashboard
        </Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Departments" value={company.departments.length} />
        <MiniStat label="Status" value={company.status || 'active'} />
        <MiniStat label="Mode" value={isDemoModeActive ? 'Demo' : 'Live'} />
      </div>

      <div className="space-y-5">
        {company.departments.length === 0 ? (
          <p className="cyvora-tactile rounded-xl p-4 text-sm text-slate-400">
            This company has no departments yet.
          </p>
        ) : (
          company.departments.map((department) => (
            <div key={department.id} className="cyvora-tactile rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-semibold text-cyan-100">{department.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{department.description}</p>
                </div>
                <span className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-300">
                  {department.teams.length} teams
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {department.teams.map((team) => (
                  <div key={team.id} className="cyvora-tactile rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-medium">{team.name}</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{team.description}</p>
                      </div>
                      <span className="cyvora-chip rounded-full px-2 py-1 text-xs text-cyan-100">
                        {team.agents.length}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {team.agents.length === 0 ? (
                        <span className="text-xs text-slate-500">No agents assigned</span>
                      ) : (
                        team.agents.map((agent) => (
                          <span
                            key={agent.id}
                            className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-200"
                          >
                            {agent.agent_name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cyvora-tactile rounded-xl p-4">
      <p className="text-[20px] font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cyvora-tactile rounded-xl p-3">
      <p className="text-[20px] font-semibold text-white">{String(value)}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function countTeams(departments?: Department[]) {
  return departments?.reduce((total, department) => total + (department.teams?.length || 0), 0) || 0;
}

function countAgents(departments?: Department[]) {
  return (
    departments?.reduce(
      (total, department) =>
        total + (department.teams?.reduce((teamTotal, team) => teamTotal + (team.agents?.length || 0), 0) || 0),
      0
    ) || 0
  );
}
