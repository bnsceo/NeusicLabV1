'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import CyvoraPageHeader from '@/components/CyvoraPageHeader';

type HistoryEvent = {
  id: string;
  category: string;
  source: string;
  source_id: string | number;
  title: string;
  description?: string;
  status?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  company_id?: number;
  company_name?: string;
  actor?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

type HistoryData = {
  tenant: string;
  generated_at: string;
  summary: {
    total_events: number;
    matched_events: number;
    returned_events: number;
    open_incidents: number;
    pending_approvals: number;
    failed_executions: number;
    estimated_cost_usd: number;
  };
  filters: {
    categories: string[];
    statuses: string[];
    companies: Array<{ id: number; name: string }>;
  };
  events: HistoryEvent[];
};

function relativeTime(value?: string) {
  if (!value) return '—';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return value;
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function dateKey(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const key = date.toDateString();
  if (key === today.toDateString()) return 'Today';
  if (key === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [company, setCompany] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'all') params.set('category', category);
      if (status !== 'all') params.set('status', status);
      if (company !== 'all') params.set('company', company);
      params.set('limit', '300');
      const response = await fetch(`/api/history?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load History');
      setData(payload);
      setError('');
      setSelectedEvent((current) => current ? payload.events.find((event: HistoryEvent) => event.id === current.id) || null : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load History');
    } finally {
      setLoading(false);
    }
  }, [query, category, status, company]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const grouped = useMemo(() => {
    const groups = new Map<string, HistoryEvent[]>();
    for (const event of data?.events || []) {
      const key = dateKey(event.timestamp);
      groups.set(key, [...(groups.get(key) || []), event]);
    }
    return [...groups.entries()];
  }, [data]);

  function exportJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cyvora-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6 lg:px-8">
        <CyvoraPageHeader
          eyebrow="Phase 12 · History"
          title="The unified operating timeline"
          description="Search missions, tasks, approvals, executions, outputs, validations, connector actions, policy decisions, incidents, and recoveries from one audit-ready history."
        >
          <button onClick={() => void load()} className="cyvora-chip rounded-xl px-4 py-2 text-xs text-cyan-100">Refresh</button>
          <button onClick={exportJson} disabled={!data?.events.length} className="cyvora-chip rounded-xl px-4 py-2 text-xs text-slate-200 disabled:opacity-50">Export JSON</button>
        </CyvoraPageHeader>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <Metric label="All events" value={data?.summary.total_events || 0} />
          <Metric label="Matched" value={data?.summary.matched_events || 0} />
          <Metric label="Returned" value={data?.summary.returned_events || 0} />
          <Metric label="Open incidents" value={data?.summary.open_incidents || 0} tone={data?.summary.open_incidents ? 'amber' : 'emerald'} />
          <Metric label="Pending approvals" value={data?.summary.pending_approvals || 0} tone={data?.summary.pending_approvals ? 'amber' : 'emerald'} />
          <Metric label="Failed executions" value={data?.summary.failed_executions || 0} tone={data?.summary.failed_executions ? 'rose' : 'emerald'} />
          <Metric label="Estimated cost" value={`$${(data?.summary.estimated_cost_usd || 0).toFixed(2)}`} tone={(data?.summary.estimated_cost_usd || 0) > 0 ? 'amber' : 'emerald'} />
        </section>

        <section className="cyvora-glass mt-6 rounded-2xl p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_200px_220px_220px_auto]">
            <div className="relative">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, descriptions, companies, or statuses…" className="w-full px-4 py-3 pr-10 text-sm" />
              {query ? <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white">Clear</button> : null}
            </div>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="cyvora-select px-4 py-3 text-sm">
              <option value="all">All categories</option>
              {data?.filters.categories.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="cyvora-select px-4 py-3 text-sm">
              <option value="all">All statuses</option>
              {data?.filters.statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <select value={company} onChange={(event) => setCompany(event.target.value)} className="cyvora-select px-4 py-3 text-sm">
              <option value="all">All companies</option>
              {data?.filters.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button onClick={() => { setQuery(''); setCategory('all'); setStatus('all'); setCompany('all'); }} className="cyvora-chip rounded-xl px-4 py-3 text-sm text-slate-300">Reset</button>
          </div>
        </section>

        {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
        {loading ? <div className="cyvora-glass mt-6 rounded-2xl p-8 text-sm text-slate-400">Building the unified audit timeline…</div> : (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="space-y-7">
              {grouped.map(([label, events]) => (
                <section key={label}>
                  <div className="mb-3 flex items-center gap-3"><h2 className="text-sm font-semibold text-slate-300">{label}</h2><div className="h-px flex-1 bg-white/[0.06]" /><span className="text-[10px] text-slate-600">{events.length} events</span></div>
                  <div className="space-y-2">
                    {events.map((event) => <TimelineRow key={event.id} event={event} selected={selectedEvent?.id === event.id} onSelect={() => setSelectedEvent(event)} />)}
                  </div>
                </section>
              ))}
              {!data?.events.length ? <Empty>No history events match the current filters.</Empty> : null}
            </div>

            <aside className="xl:sticky xl:top-24 xl:self-start">
              <Panel title="Event detail" subtitle="Source record and audit metadata">
                {selectedEvent ? <EventDetail event={selectedEvent} /> : <Empty>Select an event from the timeline.</Empty>}
              </Panel>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}

function TimelineRow({ event, selected, onSelect }: { event: HistoryEvent; selected: boolean; onSelect: () => void }) {
  return <button onClick={onSelect} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? 'border-cyan-300/25 bg-cyan-300/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.035]'}`}>
    <div className="flex items-start gap-3">
      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotForSeverity(event.severity)}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={event.category} tone="cyan" />
          {event.status ? <StatusPill label={event.status} tone={toneForStatus(event.status, event.severity)} /> : null}
          {event.company_name ? <span className="text-[10px] text-slate-600">{event.company_name}</span> : null}
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-200">{event.title}</h3>
        {event.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{event.description}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-600"><span>{event.actor || event.source}</span><span>{relativeTime(event.timestamp)}</span></div>
      </div>
    </div>
  </button>;
}

function EventDetail({ event }: { event: HistoryEvent }) {
  return <div>
    <div className="flex flex-wrap items-center gap-2"><StatusPill label={event.category} tone="cyan" /><StatusPill label={event.severity} tone={toneForStatus(event.status, event.severity)} />{event.status ? <StatusPill label={event.status} tone={toneForStatus(event.status, event.severity)} /> : null}</div>
    <h2 className="mt-4 text-xl font-semibold">{event.title}</h2>
    {event.description ? <p className="mt-3 text-sm leading-6 text-slate-400">{event.description}</p> : null}
    <dl className="mt-5 grid grid-cols-2 gap-3">
      <Detail label="Source" value={event.source} />
      <Detail label="Source ID" value={event.source_id} />
      <Detail label="Company" value={event.company_name || 'System-wide'} />
      <Detail label="Actor" value={event.actor || 'system'} />
      <Detail label="Timestamp" value={new Date(event.timestamp).toLocaleString()} wide />
    </dl>
    <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Metadata</p>
      <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-slate-400">{JSON.stringify(event.metadata, null, 2)}</pre>
    </div>
  </div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="cyvora-glass rounded-2xl p-5 md:p-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{subtitle}</p><div className="mt-5">{children}</div></section>; }
function Metric({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) { const color = tone === 'rose' ? 'text-rose-200' : tone === 'amber' ? 'text-amber-200' : tone === 'emerald' ? 'text-emerald-200' : 'text-white'; return <div className="cyvora-tactile rounded-xl p-4"><p className={`truncate text-xl font-semibold ${color}`}>{value}</p><p className="mt-1 truncate text-xs text-slate-500">{label}</p></div>; }
function Detail({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) { return <div className={`rounded-xl border border-white/[0.06] bg-black/15 p-3 ${wide ? 'col-span-2' : ''}`}><dt className="text-[9px] uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 break-words text-xs text-slate-300">{value}</dd></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] p-5 text-sm text-slate-500">{children}</p>; }
function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="mt-6 rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-6"><p className="text-sm text-rose-200">{message}</p><button onClick={onRetry} className="cyvora-chip mt-4 rounded-xl px-4 py-2 text-sm">Retry</button></div>; }
function StatusPill({ label, tone = 'cyan' }: { label: string; tone?: string }) { const style = tone === 'rose' ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : tone === 'amber' ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : tone === 'emerald' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'; return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${style}`}>{label.replaceAll('_', ' ')}</span>; }
function toneForStatus(status?: string, severity?: string) { if (severity === 'critical' || severity === 'high' || ['failed', 'blocked', 'error', 'rejected'].includes(status || '')) return 'rose'; if (severity === 'medium' || ['pending', 'queued', 'watch', 'acknowledged', 'billable'].includes(status || '')) return 'amber'; if (['completed', 'approved', 'resolved', 'final', 'zero-cost', 'healthy'].includes(status || '')) return 'emerald'; return 'cyan'; }
function dotForSeverity(severity: string) { if (severity === 'critical' || severity === 'high') return 'bg-rose-300 shadow-[0_0_12px_rgba(251,113,133,.75)]'; if (severity === 'medium') return 'bg-amber-300 shadow-[0_0_12px_rgba(244,212,135,.6)]'; if (severity === 'low') return 'bg-violet-300'; return 'bg-cyan-300 shadow-[0_0_12px_rgba(141,223,255,.6)]'; }
