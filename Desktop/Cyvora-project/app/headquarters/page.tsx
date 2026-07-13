'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CyvoraPageHeader from '@/components/CyvoraPageHeader';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

type Agent = { id: number; agent_name: string; task_type?: string };
type Team = { id: number; name: string; description?: string; agents: Agent[] };
type Department = { id: number; name: string; description?: string; teams: Team[] };
type Company = {
  id: number;
  name: string;
  description?: string;
  brand_color?: string;
  status?: string;
  departments: Department[];
  connectors: Array<{ id: number; name: string; connector_type: string; status: string }>;
  operational_summary: {
    health: { score: number; status: string };
    agents: number;
    tasks_total: number;
    tasks_active: number;
    tasks_blocked: number;
    approvals_pending: number;
    outputs_candidate: number;
    runs_active: number;
    runs_failed: number;
    connectors_enabled: number;
    connector_actions: number;
    policy_blocks: number;
    validations_failed: number;
  };
};

type HeadquartersData = {
  tenant: string;
  generated_at: string;
  executive_ai: { name: string; role: string; status: string };
  totals: Record<string, number>;
  runtime: {
    status: string;
    worker_status: string;
    worker_age_seconds: number | null;
    latest_worker: Record<string, unknown> | null;
    workers: Array<Record<string, any>>;
    queue: Record<string, number>;
  };
  companies: Company[];
  live_operations: {
    execution_runs: Array<Record<string, any>>;
    tasks: Array<Record<string, any>>;
    approvals: Array<Record<string, any>>;
    outputs: Array<Record<string, any>>;
    connector_actions: Array<Record<string, any>>;
    policy_decisions: Array<Record<string, any>>;
    validations: Array<Record<string, any>>;
  };
  activity: Array<Record<string, any>>;
};

type View = 'overview' | 'organization' | 'operations' | 'runtime';

const views: Array<{ id: View; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'organization', label: 'Organization' },
  { id: 'operations', label: 'Live Operations' },
  { id: 'runtime', label: 'Runtime Health' },
];

function relativeTime(value?: string) {
  if (!value) return '—';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return value;
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function toneForStatus(status?: string) {
  if (['healthy', 'online', 'completed', 'approved', 'active', 'final', 'enabled'].includes(status || '')) return 'emerald';
  if (['critical', 'failed', 'blocked', 'error', 'rejected'].includes(status || '')) return 'rose';
  if (['degraded', 'watch', 'pending', 'queued', 'stale', 'in_progress'].includes(status || '')) return 'amber';
  return 'cyan';
}

export default function HeadquartersPage() {
  const runtimeMode = getRuntimeModeInfo();
  const [data, setData] = useState<HeadquartersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('overview');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function load(showLoader = false) {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch('/api/headquarters', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load Headquarters');
      setData(payload);
      setError('');
      setSelectedCompanyId((current) => current && payload.companies.some((company: Company) => company.id === current) ? current : payload.companies[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Headquarters');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(true); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void load(false), 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  const selectedCompany = useMemo(
    () => data?.companies.find((company) => company.id === selectedCompanyId) || data?.companies[0] || null,
    [data, selectedCompanyId]
  );
  const selectedDepartment = useMemo(
    () => selectedCompany?.departments.find((department) => department.id === selectedDepartmentId) || selectedCompany?.departments[0] || null,
    [selectedCompany, selectedDepartmentId]
  );

  const firstDepartmentId = selectedCompany?.departments[0]?.id || null;
  useEffect(() => {
    setSelectedDepartmentId(firstDepartmentId);
  }, [firstDepartmentId]);

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6 lg:px-8">
        <CyvoraPageHeader
          eyebrow="Phase 10 · Headquarters"
          title="The live organization and operations map"
          description="Inspect every company, department, team, agent, queue, approval, connector, and runtime signal from one operating surface."
        >
          <StatusPill label={runtimeMode.label} tone="cyan" />
          <StatusPill label={data?.runtime.status || 'loading'} tone={toneForStatus(data?.runtime.status)} />
          <button onClick={() => setAutoRefresh((current) => !current)} className="cyvora-chip rounded-xl px-4 py-2 text-xs text-slate-200">
            Auto-refresh {autoRefresh ? 'on' : 'off'}
          </button>
          <button onClick={() => void load(true)} className="cyvora-chip rounded-xl px-4 py-2 text-xs text-cyan-100">Refresh now</button>
        </CyvoraPageHeader>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {views.map((item) => (
            <button key={item.id} onClick={() => setView(item.id)} className={`rounded-xl border px-4 py-2 text-sm transition ${view === item.id ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100' : 'border-white/[0.07] bg-white/[0.025] text-slate-400 hover:text-white'}`}>
              {item.label}
            </button>
          ))}
        </div>

        {loading ? <LoadingPanel /> : error ? <ErrorPanel message={error} onRetry={() => void load(true)} /> : !data ? null : (
          <>
            {view === 'overview' ? <Overview data={data} onSelectCompany={(id) => { setSelectedCompanyId(id); setView('organization'); }} /> : null}
            {view === 'organization' ? (
              <OrganizationExplorer
                data={data}
                selectedCompany={selectedCompany}
                selectedDepartment={selectedDepartment}
                onSelectCompany={setSelectedCompanyId}
                onSelectDepartment={setSelectedDepartmentId}
              />
            ) : null}
            {view === 'operations' ? <LiveOperations data={data} companyId={selectedCompanyId} onCompanyChange={setSelectedCompanyId} /> : null}
            {view === 'runtime' ? <RuntimeHealth data={data} /> : null}
          </>
        )}
      </main>
    </div>
  );
}

function Overview({ data, onSelectCompany }: { data: HeadquartersData; onSelectCompany: (id: number) => void }) {
  return (
    <section className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
        <Metric label="Companies" value={data.totals.companies} />
        <Metric label="Departments" value={data.totals.departments} />
        <Metric label="Teams" value={data.totals.teams} />
        <Metric label="Agents" value={data.totals.agents} />
        <Metric label="Tasks" value={data.totals.tasks} />
        <Metric label="Approvals" value={data.totals.approvals} tone={data.totals.approvals ? 'amber' : 'emerald'} />
        <Metric label="Connectors" value={data.totals.connectors} />
        <Metric label="Outputs" value={data.totals.outputs} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Panel title="Company health" subtitle="Operational posture across the founder workspace">
          {data.companies.length === 0 ? <Empty>No active companies yet.</Empty> : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.companies.map((company) => (
                <button key={company.id} onClick={() => onSelectCompany(company.id)} className="cyvora-tactile rounded-2xl p-5 text-left transition hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-11 w-11 shrink-0 rounded-xl border border-white/10" style={{ background: company.brand_color || '#8ddfff' }} />
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{company.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{company.departments.length} departments · {company.operational_summary.agents} agents</p>
                      </div>
                    </div>
                    <HealthRing score={company.operational_summary.health.score} />
                  </div>
                  <div className="mt-5 grid grid-cols-4 gap-2">
                    <TinyMetric label="Active" value={company.operational_summary.tasks_active} />
                    <TinyMetric label="Blocked" value={company.operational_summary.tasks_blocked} tone={company.operational_summary.tasks_blocked ? 'rose' : 'slate'} />
                    <TinyMetric label="Approvals" value={company.operational_summary.approvals_pending} tone={company.operational_summary.approvals_pending ? 'amber' : 'slate'} />
                    <TinyMetric label="Runs" value={company.operational_summary.runs_active} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Operations pulse" subtitle={`Updated ${relativeTime(data.generated_at)}`}>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Queued runs" value={data.runtime.queue.queued_runs} />
            <Metric label="Runs in progress" value={data.runtime.queue.in_progress_runs} tone="cyan" />
            <Metric label="Blocked runs" value={data.runtime.queue.failed_runs} tone={data.runtime.queue.failed_runs ? 'rose' : 'emerald'} />
            <Metric label="Blocked tasks" value={data.runtime.queue.blocked_tasks} tone={data.runtime.queue.blocked_tasks ? 'rose' : 'emerald'} />
          </div>
          <div className="cyvora-tactile mt-4 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Execution worker</p>
                <p className="mt-1 text-xs text-slate-500">{String(data.runtime.latest_worker?.worker_id || 'No worker registered')}</p>
              </div>
              <StatusPill label={data.runtime.worker_status} tone={toneForStatus(data.runtime.worker_status)} />
            </div>
            <p className="mt-3 text-xs text-slate-400">Last heartbeat: {data.runtime.worker_age_seconds === null ? 'unknown' : `${data.runtime.worker_age_seconds}s ago`}</p>
          </div>
          <Link href="/war-room" className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-slate-300 transition hover:border-cyan-300/20 hover:text-white">
            Open War Room <span>→</span>
          </Link>
        </Panel>
      </div>

      <Panel title="Recent operating activity" subtitle="The latest events across companies and runtime">
        <div className="space-y-2">
          {data.activity.slice(0, 10).map((event) => (
            <div key={event.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(141,223,255,.7)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200">{event.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{event.description || event.event_type}</p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-600">{relativeTime(event.created_at)}</span>
            </div>
          ))}
          {data.activity.length === 0 ? <Empty>No operating events have been recorded.</Empty> : null}
        </div>
      </Panel>
    </section>
  );
}

function OrganizationExplorer({ data, selectedCompany, selectedDepartment, onSelectCompany, onSelectDepartment }: {
  data: HeadquartersData;
  selectedCompany: Company | null;
  selectedDepartment: Department | null;
  onSelectCompany: (id: number) => void;
  onSelectDepartment: (id: number) => void;
}) {
  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[280px_330px_1fr]">
      <Panel title="Companies" subtitle="Select an operating entity" compact>
        <div className="space-y-2">
          {data.companies.map((company) => (
            <button key={company.id} onClick={() => onSelectCompany(company.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedCompany?.id === company.id ? 'border-cyan-300/25 bg-cyan-300/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-lg" style={{ background: company.brand_color || '#8ddfff' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{company.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Health {company.operational_summary.health.score}%</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Departments" subtitle={selectedCompany?.name || 'No company selected'} compact>
        <div className="space-y-2">
          {selectedCompany?.departments.map((department) => (
            <button key={department.id} onClick={() => onSelectDepartment(department.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedDepartment?.id === department.id ? 'border-violet-300/25 bg-violet-300/[0.07]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <p className="text-sm font-semibold">{department.name}</p>
              <p className="mt-1 text-xs text-slate-500">{department.teams.length} teams · {department.teams.reduce((sum, team) => sum + team.agents.length, 0)} agents</p>
            </button>
          ))}
          {!selectedCompany?.departments.length ? <Empty>No departments found.</Empty> : null}
        </div>
      </Panel>

      <Panel title={selectedDepartment?.name || 'Organization detail'} subtitle="Teams and assigned digital employees">
        {selectedDepartment ? (
          <div className="space-y-4">
            {selectedDepartment.teams.map((team) => (
              <div key={team.id} className="cyvora-tactile rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{team.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{team.description || 'Operational team'}</p>
                  </div>
                  <StatusPill label={`${team.agents.length} agents`} tone="violet" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {team.agents.map((agent) => (
                    <div key={agent.id} className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.05] text-[10px] font-bold text-cyan-100">AI</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{agent.agent_name}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-500">{agent.task_type || 'General operations'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {team.agents.length === 0 ? <p className="text-xs text-slate-500">No agents assigned.</p> : null}
                </div>
              </div>
            ))}
            {selectedDepartment.teams.length === 0 ? <Empty>No teams found.</Empty> : null}
          </div>
        ) : <Empty>Select a department to inspect its teams.</Empty>}
      </Panel>
    </section>
  );
}

function LiveOperations({ data, companyId, onCompanyChange }: { data: HeadquartersData; companyId: number | null; onCompanyChange: (id: number | null) => void }) {
  const filter = <T extends Record<string, any>>(items: T[]) => companyId ? items.filter((item) => item.company_id === companyId) : items;
  const runs = filter(data.live_operations.execution_runs);
  const tasks = filter(data.live_operations.tasks);
  const approvals = filter(data.live_operations.approvals);
  const actions = filter(data.live_operations.connector_actions);

  return (
    <section className="mt-6 space-y-6">
      <div className="cyvora-glass rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Live operations scope</p>
            <p className="mt-1 text-xs text-slate-500">Filter queues and actions by company.</p>
          </div>
          <select value={companyId || ''} onChange={(event) => onCompanyChange(event.target.value ? Number(event.target.value) : null)} className="cyvora-select min-w-[220px] px-4 py-2 text-sm">
            <option value="">All companies</option>
            {data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Execution runs" subtitle="Queue, leases, and completion state">
          <OperationList items={runs.slice(0, 15)} empty="No execution runs in this scope." render={(run) => ({
            title: `Run #${run.id}: ${run.goal}`,
            subtitle: run.error_message || `${run.runtime_mode} · attempt ${run.attempt_count || 0}/${run.max_attempts || 3}`,
            status: run.status,
            time: run.updated_at || run.started_at,
          })} />
        </Panel>
        <Panel title="Task queue" subtitle="Active, in-progress, and blocked work">
          <OperationList items={tasks.slice(0, 15)} empty="No tasks in this scope." render={(task) => ({
            title: task.title,
            subtitle: `${task.company_name || 'Company'} · ${task.assigned_agent || 'unassigned'} · ${task.priority}`,
            status: task.status,
            time: task.updated_at,
          })} />
        </Panel>
        <Panel title="Founder approvals" subtitle="Decisions waiting at the governance boundary">
          <OperationList items={approvals.slice(0, 15)} empty="No pending approvals." render={(approval) => ({
            title: approval.title,
            subtitle: approval.summary || `${approval.approval_type} · ${approval.risk_level} risk`,
            status: approval.status,
            time: approval.updated_at,
          })} />
          <Link href="/command-center" className="mt-4 inline-flex text-xs text-cyan-200 hover:text-white">Open approval queue →</Link>
        </Panel>
        <Panel title="Connector and policy flow" subtitle="Governed external-action simulations">
          <OperationList items={actions.slice(0, 15)} empty="No connector actions recorded." render={(action) => ({
            title: `${action.connector_id}.${action.action_id}`,
            subtitle: `${action.mode} · policy ${action.policy_effect} · ${action.side_effect}`,
            status: action.status,
            time: action.completed_at || action.created_at,
          })} />
        </Panel>
      </div>
    </section>
  );
}

function RuntimeHealth({ data }: { data: HeadquartersData }) {
  return (
    <section className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Worker status" value={data.runtime.worker_status} tone={toneForStatus(data.runtime.worker_status)} />
        <Metric label="Queued runs" value={data.runtime.queue.queued_runs} />
        <Metric label="In progress" value={data.runtime.queue.in_progress_runs + data.runtime.queue.in_progress_tasks} tone="cyan" />
        <Metric label="Blocked work" value={data.runtime.queue.failed_runs + data.runtime.queue.blocked_tasks} tone={data.runtime.queue.failed_runs + data.runtime.queue.blocked_tasks ? 'rose' : 'emerald'} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_.75fr]">
        <Panel title="Worker fleet" subtitle="Heartbeats, leases, and current assignments">
          <div className="space-y-3">
            {data.runtime.workers.map((worker) => {
              const stale = worker.last_seen_at ? new Date(data.generated_at).getTime() - new Date(worker.last_seen_at).getTime() > 90000 : true;
              return (
                <div key={worker.worker_id} className="cyvora-tactile rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-white">{worker.worker_id}</p>
                      <p className="mt-1 text-xs text-slate-500">{worker.hostname || 'unknown host'} · PID {worker.process_id || '—'} · v{worker.version || '—'}</p>
                    </div>
                    <StatusPill label={stale ? 'stale' : worker.status || 'online'} tone={stale ? 'amber' : 'emerald'} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <TinyMetric label="Run" value={worker.current_run_id || '—'} />
                    <TinyMetric label="Task" value={worker.current_task_id || '—'} />
                    <TinyMetric label="Seen" value={relativeTime(worker.last_seen_at)} />
                  </div>
                </div>
              );
            })}
            {data.runtime.workers.length === 0 ? <Empty>No worker heartbeat has been recorded.</Empty> : null}
          </div>
        </Panel>
        <Panel title="Queue pressure" subtitle="Current runtime demand">
          <div className="space-y-4">
            {Object.entries(data.runtime.queue).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-xs"><span className="capitalize text-slate-400">{key.replaceAll('_', ' ')}</span><span className="font-mono text-white">{value}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300/70 to-violet-300/70" style={{ width: `${Math.min(100, Number(value) * 12)}%` }} /></div>
              </div>
            ))}
          </div>
          <Link href="/war-room" className="mt-6 flex items-center justify-between rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-sm text-amber-100">Open incident recovery <span>→</span></Link>
        </Panel>
      </div>
    </section>
  );
}

function OperationList<T extends Record<string, any>>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => { title: string; subtitle: string; status: string; time?: string } }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return <div className="space-y-2">{items.map((item, index) => { const row = render(item); return (
    <div key={item.id || index} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{row.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{row.subtitle}</p></div>
        <StatusPill label={row.status} tone={toneForStatus(row.status)} />
      </div>
      {row.time ? <p className="mt-2 text-[10px] text-slate-600">{relativeTime(row.time)}</p> : null}
    </div>
  ); })}</div>;
}

function Panel({ title, subtitle, children, compact = false }: { title: string; subtitle: string; children: React.ReactNode; compact?: boolean }) {
  return <section className={`cyvora-glass rounded-2xl ${compact ? 'p-4' : 'p-5 md:p-6'}`}><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{subtitle}</p></div><div className="mt-5">{children}</div></section>;
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) {
  const color = tone === 'rose' ? 'text-rose-200' : tone === 'amber' ? 'text-amber-200' : tone === 'emerald' ? 'text-emerald-200' : tone === 'cyan' ? 'text-cyan-100' : 'text-white';
  return <div className="cyvora-tactile rounded-xl p-4"><p className={`truncate text-xl font-semibold ${color}`}>{value}</p><p className="mt-1 truncate text-xs text-slate-500">{label}</p></div>;
}

function TinyMetric({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) {
  const color = tone === 'rose' ? 'text-rose-200' : tone === 'amber' ? 'text-amber-200' : 'text-slate-200';
  return <div className="rounded-lg border border-white/[0.05] bg-black/15 p-2 text-center"><p className={`truncate text-sm font-semibold ${color}`}>{value}</p><p className="mt-1 truncate text-[9px] uppercase tracking-wider text-slate-600">{label}</p></div>;
}

function StatusPill({ label, tone = 'cyan' }: { label: string; tone?: string }) {
  const style = tone === 'rose' ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : tone === 'amber' ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : tone === 'emerald' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : tone === 'violet' ? 'border-violet-300/20 bg-violet-300/10 text-violet-200' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${style}`}>{label}</span>;
}

function HealthRing({ score }: { score: number }) {
  const color = score >= 90 ? '#6ee7b7' : score >= 70 ? '#f4d487' : '#fb7185';
  return <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,.06) 0)` }}><div className="grid h-9 w-9 place-items-center rounded-full bg-[#0a1321] text-[10px] font-bold">{score}</div></div>;
}

function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] p-5 text-sm text-slate-500">{children}</p>; }
function LoadingPanel() { return <div className="cyvora-glass mt-6 rounded-2xl p-8 text-sm text-slate-400">Building the live operating map…</div>; }
function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="mt-6 rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-6"><p className="text-sm text-rose-200">{message}</p><button onClick={onRetry} className="cyvora-chip mt-4 rounded-xl px-4 py-2 text-sm">Retry</button></div>; }
