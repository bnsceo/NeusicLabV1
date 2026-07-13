'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import CyvoraPageHeader from '@/components/CyvoraPageHeader';

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePanel, setActivePanel] = useState<'connectors' | 'tasks' | 'outputs'>('tasks');
  const [updatingApprovalId, setUpdatingApprovalId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/companies/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load company');
        return res.json();
      })
      .then(setCompany)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const totals = useMemo(() => {
    if (!company) return { departments: 0, teams: 0, agents: 0, tasks: 0, approvals: 0 };
    const orgTotals = company.departments?.reduce(
      (acc: any, department: any) => {
        acc.departments += 1;
        acc.teams += department.teams?.length || 0;
        for (const team of department.teams || []) acc.agents += team.agents?.length || 0;
        return acc;
      },
      { departments: 0, teams: 0, agents: 0 }
    );
    return {
      ...orgTotals,
      tasks: company.tasks?.length || 0,
      approvals: company.approvals?.filter((approval: any) => approval.status === 'pending').length || 0,
    };
  }, [company]);

  const connectorCount = company?.connectors?.length || 0;
  const taskCount = company?.tasks?.length || 0;
  const outputCount = company?.outputs?.length || 0;

  const approveApproval = async (approvalId: number) => {
    if (!company) return;
    setUpdatingApprovalId(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to approve item');
        return;
      }
      const refreshed = await fetch(`/api/companies/${id}`).then((response) => response.json());
      setCompany(refreshed);
    } catch {
      alert('Failed to approve item');
    } finally {
      setUpdatingApprovalId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] text-white">
        <main className="mx-auto max-w-7xl px-4 py-10 text-slate-400">Loading company...</main>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-[#070b12] text-white">
        <main className="mx-auto max-w-7xl px-4 py-10 text-rose-200">Error: {error || 'Not found'}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <CyvoraPageHeader
          eyebrow="Company Dashboard"
          title={company.name}
          description={company.description}
        >
          <div
            className="h-14 w-14 rounded-2xl border border-white/10 shadow-[inset_1px_1px_0_rgba(255,255,255,0.05),8px_8px_16px_rgba(0,0,0,0.28)]"
            style={{ backgroundColor: company.brand_color || '#38bdf8' }}
            aria-hidden="true"
          />
          <Link href="/headquarters" className="cyvora-chip inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm text-slate-200 transition hover:translate-y-[-1px]">
            Headquarters
          </Link>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Departments" value={totals.departments} />
            <Stat label="Teams" value={totals.teams} />
            <Stat label="Agents" value={totals.agents} />
            <Stat label="Tasks" value={totals.tasks} />
            <Stat label="Approvals" value={totals.approvals} />
          </div>
        </CyvoraPageHeader>
        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="cyvora-glass rounded-2xl p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Live command nodes</h2>
                <p className="mt-1 text-sm text-slate-400">Connectors, tasks, and outputs are first-class nodes now</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActivePanel('connectors')} className={`cyvora-chip rounded-full px-3 py-1 font-mono text-xs ${activePanel === 'connectors' ? 'text-cyan-100' : 'text-slate-300'}`}>Connectors {connectorCount}</button>
                <button onClick={() => setActivePanel('tasks')} className={`cyvora-chip rounded-full px-3 py-1 font-mono text-xs ${activePanel === 'tasks' ? 'text-cyan-100' : 'text-slate-300'}`}>Tasks {taskCount}</button>
                <button onClick={() => setActivePanel('outputs')} className={`cyvora-chip rounded-full px-3 py-1 font-mono text-xs ${activePanel === 'outputs' ? 'text-cyan-100' : 'text-slate-300'}`}>Outputs {outputCount}</button>
              </div>
            </div>
            <div className="space-y-3">
              {activePanel === 'connectors' ? (
                company.connectors?.length ? (
                  company.connectors.map((connector: any) => (
                    <LiveNodeCard
                      key={connector.id}
                      title={connector.name}
                      meta={`${connector.connector_type} · ${connector.status}`}
                      description={connector.summary || 'Connector summary unavailable.'}
                    />
                  ))
                ) : (
                  <EmptyState>No connectors yet.</EmptyState>
                )
              ) : null}

              {activePanel === 'tasks' ? (
                company.tasks?.length ? (
                  company.tasks.map((task: any) => (
                    <LiveNodeCard
                      key={task.id}
                      title={task.title}
                      meta={`${task.workflow_stage} · ${task.priority} priority`}
                      description={task.description}
                      badge={task.assigned_agent || 'Executive AI'}
                    />
                  ))
                ) : (
                  <EmptyState>No tasks yet.</EmptyState>
                )
              ) : null}

              {activePanel === 'outputs' ? (
                company.outputs?.length ? (
                  company.outputs.slice(0, 8).map((output: any) => (
                    <LiveNodeCard
                      key={output.id}
                      title={output.title}
                      meta={`${output.output_type} · ${output.status}`}
                      description={output.summary || 'Output summary unavailable.'}
                      badge={output.owner || 'Generated'}
                    />
                  ))
                ) : (
                  <EmptyState>No outputs generated yet.</EmptyState>
                )
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="cyvora-glass rounded-2xl p-5 md:p-6">
              <h2 className="text-lg font-semibold">Approval queue</h2>
              <div className="mt-4 space-y-3">
                {company.approvals?.length ? (
                  company.approvals.map((approval: any) => (
                    <div key={approval.id} className="cyvora-tactile rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-amber-100">{approval.title}</p>
                          <p className="mt-1 text-xs leading-5 text-amber-50/80">{approval.summary}</p>
                          <p className="mt-2 text-xs text-amber-100/70">{approval.status} · {approval.risk_level} risk</p>
                        </div>
                        {approval.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => approveApproval(approval.id)}
                            disabled={updatingApprovalId === approval.id}
                            className="cyvora-chip rounded-xl px-3 py-2 text-xs text-slate-200 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingApprovalId === approval.id ? 'Approving…' : 'Approve'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No approvals waiting.</p>
                )}
              </div>
            </div>

            <div className="cyvora-glass rounded-2xl p-5 md:p-6">
              <h2 className="text-lg font-semibold">Structure detail</h2>
              <p className="mt-1 text-sm text-slate-400">Departments and teams on mobile stay readable.</p>
              <div className="mt-4 space-y-3">
                {company.departments?.length ? (
                  company.departments.slice(0, 3).map((department: any) => (
                    <div key={department.id} className="cyvora-tactile rounded-xl p-4">
                      <p className="text-sm font-medium text-cyan-100">{department.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{department.description}</p>
                      <p className="mt-2 text-xs text-slate-500">{department.teams?.length || 0} teams</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No departments yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 cyvora-glass-strong rounded-2xl p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Operating structure</h2>
              <p className="mt-1 text-sm text-slate-400">Departments, teams, and assigned agents</p>
            </div>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
              {company.status || 'active'}
            </span>
          </div>

          <div className="space-y-5">
            {company.departments?.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-slate-400">No departments yet.</p>
            )}
            {company.departments?.map((department: any) => (
              <div key={department.id} className="cyvora-tactile rounded-2xl p-4">
                <div className="border-b border-white/10 pb-3">
                  <h3 className="font-semibold text-cyan-100">{department.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{department.description}</p>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {department.teams?.map((team: any) => (
                    <div key={team.id} className="cyvora-glass rounded-xl p-4">
                      <h4 className="text-sm font-medium">{team.name}</h4>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{team.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {team.agents?.length ? (
                          team.agents.map((agent: any) => (
                            <span key={agent.id} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                              {agent.agent_name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">No agents assigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6">
          <Link href="/companies" className="cyvora-chip inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm text-cyan-100 transition hover:translate-y-[-1px]">
            Back to Companies
          </Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cyvora-glass rounded-2xl p-5">
      <p className="text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

function LiveNodeCard({
  title,
  meta,
  description,
  badge,
}: {
  title: string;
  meta: string;
  description?: string;
  badge?: string;
}) {
  return (
    <div className="cyvora-tactile rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{meta}</p>
        </div>
        {badge ? <span className="cyvora-chip rounded-full px-3 py-1 font-mono text-[11px] text-slate-300">{badge}</span> : null}
      </div>
      {description ? <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p> : null}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="cyvora-tactile rounded-xl p-5 text-sm text-slate-400">{children}</p>;
}
