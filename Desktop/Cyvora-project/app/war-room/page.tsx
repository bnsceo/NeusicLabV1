'use client';

import { useEffect, useMemo, useState } from 'react';
import CyvoraPageHeader from '@/components/CyvoraPageHeader';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

type Incident = {
  id: number;
  company_id?: number;
  company_name?: string;
  fingerprint: string;
  source_type: string;
  source_id?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  status: 'open' | 'acknowledged' | 'resolved';
  remediation?: string;
  target_type?: string;
  target_id?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type WarRoomData = {
  tenant: string;
  generated_at: string;
  posture: {
    status: string;
    open_incidents: number;
    critical_incidents: number;
    high_incidents: number;
    resolved_incidents: number;
  };
  runtime: {
    latest_worker: Record<string, any> | null;
    worker_age_seconds: number | null;
    worker_status: string;
    workers: Array<Record<string, any>>;
    queue: Record<string, number>;
  };
  incidents: Incident[];
  failed_runs: Array<Record<string, any>>;
  blocked_tasks: Array<Record<string, any>>;
  validation_failures: Array<Record<string, any>>;
  connector_failures: Array<Record<string, any>>;
  policy_blocks: Array<Record<string, any>>;
  recovery_actions: Array<Record<string, any>>;
};

type View = 'incidents' | 'runtime' | 'recovery';

const views: Array<{ id: View; label: string }> = [
  { id: 'incidents', label: 'Incidents' },
  { id: 'runtime', label: 'Workers & Queue' },
  { id: 'recovery', label: 'Recovery Log' },
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

export default function WarRoomPage() {
  const runtimeMode = getRuntimeModeInfo();
  const [data, setData] = useState<WarRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('incidents');
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch('/api/warroom', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load War Room');
      setData(payload);
      setError('');
      setSelectedIncident((current) => current ? payload.incidents.find((incident: Incident) => incident.id === current.id) || null : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load War Room');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredIncidents = useMemo(() => {
    if (!data) return [];
    return data.incidents.filter((incident) => {
      const statusMatch = statusFilter === 'all' || (statusFilter === 'active' ? incident.status !== 'resolved' : incident.status === statusFilter);
      const severityMatch = severityFilter === 'all' || incident.severity === severityFilter;
      return statusMatch && severityMatch;
    });
  }, [data, severityFilter, statusFilter]);

  async function act(action: 'acknowledge' | 'resolve' | 'retry_run' | 'requeue_task' | 'recheck', incident?: Incident) {
    const key = `${action}:${incident?.id || 'all'}`;
    setSubmitting(key);
    try {
      const response = await fetch('/api/warroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          incident_id: incident?.id,
          target_id: incident?.target_id,
          requested_by: 'founder',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Recovery action failed');
      setData(payload);
      setError('');
      setSelectedIncident(incident ? payload.incidents.find((item: Incident) => item.id === incident.id) || null : null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Recovery action failed');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6 lg:px-8">
        <CyvoraPageHeader
          eyebrow="Phase 11 · War Room"
          title="Reliability, incidents, and governed recovery"
          description="Detect blocked work, stale workers, failed validations, connector failures, and policy stops—then recover without bypassing Cyvora’s approval and safety boundaries."
        >
          <StatusPill label={runtimeMode.label} tone="cyan" />
          <StatusPill label={data?.posture.status || 'loading'} tone={toneForStatus(data?.posture.status)} />
          <button onClick={() => void act('recheck')} disabled={Boolean(submitting)} className="cyvora-chip rounded-xl px-4 py-2 text-xs text-cyan-100 disabled:opacity-50">
            {submitting === 'recheck:all' ? 'Rechecking…' : 'Recheck system'}
          </button>
        </CyvoraPageHeader>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {views.map((item) => (
            <button key={item.id} onClick={() => setView(item.id)} className={`rounded-xl border px-4 py-2 text-sm transition ${view === item.id ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-white/[0.07] bg-white/[0.025] text-slate-400 hover:text-white'}`}>
              {item.label}
            </button>
          ))}
        </div>

        {loading ? <div className="cyvora-glass mt-6 rounded-2xl p-8 text-sm text-slate-400">Scanning the runtime and incident ledger…</div> : error && !data ? <ErrorPanel message={error} onRetry={() => void load()} /> : data ? (
          <>
            {error ? <div className="mt-5 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] px-4 py-3 text-sm text-rose-200">{error}</div> : null}
            <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Open incidents" value={data.posture.open_incidents} tone={data.posture.open_incidents ? 'amber' : 'emerald'} />
              <Metric label="Critical" value={data.posture.critical_incidents} tone={data.posture.critical_incidents ? 'rose' : 'emerald'} />
              <Metric label="High" value={data.posture.high_incidents} tone={data.posture.high_incidents ? 'rose' : 'emerald'} />
              <Metric label="Blocked runs" value={data.runtime.queue.blocked_runs} tone={data.runtime.queue.blocked_runs ? 'rose' : 'emerald'} />
              <Metric label="Blocked tasks" value={data.runtime.queue.blocked_tasks} tone={data.runtime.queue.blocked_tasks ? 'rose' : 'emerald'} />
              <Metric label="Worker" value={data.runtime.worker_status} tone={toneForStatus(data.runtime.worker_status)} />
            </section>

            {view === 'incidents' ? (
              <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
                <Panel title="Incident queue" subtitle="Derived from runtime state and persistent operational records">
                  <div className="mb-4 flex flex-wrap gap-3">
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="cyvora-select px-4 py-2 text-sm">
                      <option value="active">Active</option>
                      <option value="open">Open</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="resolved">Resolved</option>
                      <option value="all">All statuses</option>
                    </select>
                    <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="cyvora-select px-4 py-2 text-sm">
                      <option value="all">All severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    {filteredIncidents.map((incident) => (
                      <button key={incident.id} onClick={() => setSelectedIncident(incident)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedIncident?.id === incident.id ? 'border-amber-300/25 bg-amber-300/[0.07]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.035]'}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill label={incident.severity} tone={toneForStatus(incident.severity)} />
                          <StatusPill label={incident.status} tone={toneForStatus(incident.status)} />
                          <span className="text-[10px] uppercase tracking-wider text-slate-600">{incident.source_type.replaceAll('_', ' ')}</span>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold">{incident.title}</h3>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{incident.description || 'No incident description.'}</p>
                        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-slate-600">
                          <span>{incident.company_name || 'System-wide'}</span>
                          <span>{relativeTime(incident.updated_at)}</span>
                        </div>
                      </button>
                    ))}
                    {filteredIncidents.length === 0 ? <Empty>No incidents match these filters.</Empty> : null}
                  </div>
                </Panel>

                <Panel title="Incident detail" subtitle="Root cause, remediation, and safe recovery controls">
                  {selectedIncident ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill label={selectedIncident.severity} tone={toneForStatus(selectedIncident.severity)} />
                        <StatusPill label={selectedIncident.status} tone={toneForStatus(selectedIncident.status)} />
                      </div>
                      <h2 className="mt-4 text-xl font-semibold">{selectedIncident.title}</h2>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{selectedIncident.description}</p>
                      <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.03] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Recommended remediation</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{selectedIncident.remediation || 'Review the source record before taking action.'}</p>
                      </div>
                      <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
                        <Detail label="Company" value={selectedIncident.company_name || 'System-wide'} />
                        <Detail label="Source" value={`${selectedIncident.source_type} ${selectedIncident.source_id || ''}`} />
                        <Detail label="Target" value={selectedIncident.target_type ? `${selectedIncident.target_type} #${selectedIncident.target_id}` : 'No automated target'} />
                        <Detail label="Updated" value={relativeTime(selectedIncident.updated_at)} />
                      </dl>
                      <div className="mt-6 grid gap-2 sm:grid-cols-2">
                        {selectedIncident.status === 'open' ? <ActionButton label="Acknowledge" busy={submitting === `acknowledge:${selectedIncident.id}`} onClick={() => void act('acknowledge', selectedIncident)} /> : null}
                        {selectedIncident.status !== 'resolved' ? <ActionButton label="Resolve incident" busy={submitting === `resolve:${selectedIncident.id}`} onClick={() => void act('resolve', selectedIncident)} /> : null}
                        {selectedIncident.target_type === 'execution_run' ? <ActionButton label="Retry execution run" emphasis busy={submitting === `retry_run:${selectedIncident.id}`} onClick={() => void act('retry_run', selectedIncident)} /> : null}
                        {selectedIncident.target_type === 'task' ? <ActionButton label="Requeue task" emphasis busy={submitting === `requeue_task:${selectedIncident.id}`} onClick={() => void act('requeue_task', selectedIncident)} /> : null}
                      </div>
                      {runtimeMode.mode === 'demo' ? <p className="mt-4 text-xs text-amber-200">Recovery controls are read-only in demo mode.</p> : null}
                    </div>
                  ) : <Empty>Select an incident to inspect remediation and recovery options.</Empty>}
                </Panel>
              </section>
            ) : null}

            {view === 'runtime' ? <RuntimeView data={data} /> : null}
            {view === 'recovery' ? <RecoveryView data={data} /> : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

function RuntimeView({ data }: { data: WarRoomData }) {
  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_.8fr]">
      <Panel title="Worker fleet" subtitle="Heartbeat freshness and current leases">
        <div className="space-y-3">
          {data.runtime.workers.map((worker) => {
            const age = worker.last_seen_at ? Math.floor((new Date(data.generated_at).getTime() - new Date(worker.last_seen_at).getTime()) / 1000) : null;
            const stale = age === null || age > 90;
            return <div key={worker.worker_id} className="cyvora-tactile rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm">{worker.worker_id}</p>
                  <p className="mt-1 text-xs text-slate-500">{worker.hostname || 'unknown host'} · PID {worker.process_id || '—'} · version {worker.version || '—'}</p>
                </div>
                <StatusPill label={stale ? 'stale' : worker.status || 'online'} tone={stale ? 'amber' : 'emerald'} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Detail label="Current run" value={worker.current_run_id || '—'} />
                <Detail label="Current task" value={worker.current_task_id || '—'} />
                <Detail label="Heartbeat" value={age === null ? 'unknown' : `${age}s ago`} />
              </div>
            </div>;
          })}
          {data.runtime.workers.length === 0 ? <Empty>No workers are reporting heartbeats.</Empty> : null}
        </div>
      </Panel>

      <Panel title="Queue pressure" subtitle="Current workload and failure pressure">
        <div className="space-y-4">
          {Object.entries(data.runtime.queue).map(([key, value]) => (
            <div key={key}>
              <div className="flex items-center justify-between text-xs"><span className="capitalize text-slate-400">{key.replaceAll('_', ' ')}</span><span className="font-mono text-white">{value}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30"><div className={`h-full rounded-full ${key.includes('blocked') ? 'bg-rose-300/70' : 'bg-cyan-300/70'}`} style={{ width: `${Math.min(100, Number(value) * 12)}%` }} /></div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Blocked execution runs" subtitle="Runs eligible for founder-reviewed retry">
        <RuntimeRows items={data.failed_runs} kind="run" />
      </Panel>
      <Panel title="Blocked tasks" subtitle="Tasks eligible for controlled requeue">
        <RuntimeRows items={data.blocked_tasks} kind="task" />
      </Panel>
      <Panel title="Validation failures" subtitle="Candidate outputs that did not clear validation">
        <RuntimeRows items={data.validation_failures} kind="validation" />
      </Panel>
      <Panel title="Policy and connector stops" subtitle="Safety decisions and connector failures">
        <div className="space-y-4">
          <RuntimeRows items={data.policy_blocks} kind="policy" />
          <RuntimeRows items={data.connector_failures} kind="connector" />
        </div>
      </Panel>
    </section>
  );
}

function RecoveryView({ data }: { data: WarRoomData }) {
  return <section className="mt-6"><Panel title="Recovery action ledger" subtitle="Every founder intervention is recorded for audit and History">
    <div className="space-y-3">
      {data.recovery_actions.map((action) => <div key={action.id} className="cyvora-tactile rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold capitalize">{String(action.action_type).replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-slate-500">{action.company_name || 'System-wide'} · {action.requested_by}</p></div><StatusPill label={action.status} tone={toneForStatus(action.status)} /></div>
        <p className="mt-3 text-sm text-slate-400">{action.result || 'No result recorded.'}</p>
        <p className="mt-3 text-[10px] text-slate-600">{relativeTime(action.completed_at || action.created_at)} · target {action.target_type || 'none'} {action.target_id ? `#${action.target_id}` : ''}</p>
      </div>)}
      {data.recovery_actions.length === 0 ? <Empty>No recovery actions have been recorded.</Empty> : null}
    </div>
  </Panel></section>;
}

function RuntimeRows({ items, kind }: { items: Array<Record<string, any>>; kind: string }) {
  if (items.length === 0) return <Empty>No {kind} failures recorded.</Empty>;
  return <div className="space-y-2">{items.slice(0, 10).map((item, index) => {
    const title = kind === 'run' ? `Run #${item.id}: ${item.goal}` : kind === 'task' ? item.title : kind === 'validation' ? `Validation #${item.id}` : kind === 'policy' ? `${item.policy_pack}: ${item.effect}` : `${item.connector_id}.${item.action_id}`;
    const detail = item.error_message || item.last_error || item.decision || item.reason || item.result?.message || item.status;
    return <div key={item.id || index} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{detail}</p></div><StatusPill label={item.status || item.effect || 'blocked'} tone="rose" /></div></div>;
  })}</div>;
}

function ActionButton({ label, onClick, busy, emphasis = false }: { label: string; onClick: () => void; busy: boolean; emphasis?: boolean }) {
  return <button onClick={onClick} disabled={busy} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${emphasis ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15' : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:text-white'}`}>{busy ? 'Working…' : label}</button>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="cyvora-glass rounded-2xl p-5 md:p-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{subtitle}</p><div className="mt-5">{children}</div></section>; }
function Metric({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) { const color = tone === 'rose' ? 'text-rose-200' : tone === 'amber' ? 'text-amber-200' : tone === 'emerald' ? 'text-emerald-200' : 'text-white'; return <div className="cyvora-tactile rounded-xl p-4"><p className={`truncate text-xl font-semibold ${color}`}>{value}</p><p className="mt-1 truncate text-xs text-slate-500">{label}</p></div>; }
function Detail({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3"><dt className="text-[9px] uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 truncate text-xs text-slate-300">{value}</dd></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] p-5 text-sm text-slate-500">{children}</p>; }
function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="mt-6 rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-6"><p className="text-sm text-rose-200">{message}</p><button onClick={onRetry} className="cyvora-chip mt-4 rounded-xl px-4 py-2 text-sm">Retry</button></div>; }
function StatusPill({ label, tone = 'cyan' }: { label: string; tone?: string }) { const style = tone === 'rose' ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : tone === 'amber' ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : tone === 'emerald' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'; return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${style}`}>{label}</span>; }
function toneForStatus(status?: string) { if (['healthy', 'online', 'completed', 'resolved', 'approved', 'low', 'info'].includes(status || '')) return 'emerald'; if (['critical', 'failed', 'blocked', 'error', 'high'].includes(status || '')) return 'rose'; if (['degraded', 'watch', 'pending', 'queued', 'stale', 'acknowledged', 'medium'].includes(status || '')) return 'amber'; return 'cyan'; }
