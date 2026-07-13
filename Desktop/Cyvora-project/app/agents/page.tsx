'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Agent = { id: string; slug: string; name: string; role: string; summary: string; category: string; source: string; version: string; lifecycle: string; provider: string; risk: string; costProfile: string; capabilities: string[]; tags: string[]; assignedTemplates: string[] };
type Stats = { total: number; assigned: number; highRisk: number; categories: string[]; sources: string[] };

export default function AgentRegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('all');
  const [source, setSource] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query, category, risk, source, limit: '500' });
      fetch(`/api/agents?${params}`).then((response) => response.json()).then((data) => { setAgents(data.agents || []); setStats(data.stats || null); }).catch(() => undefined).finally(() => setLoading(false));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query, category, risk, source]);

  const displayedCategories = useMemo(() => stats?.categories || [], [stats]);

  return <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
    <section className="cyvora-glass-strong rounded-3xl p-6 md:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[0.24em] text-violet-200/75">Phase 7 · Agent Registry</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">Agent Registry</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">The persona library is now a searchable workforce registry with versions, capabilities, lifecycle, risk, source, mock provider status, and company-template assignments.</p></div><div className="flex flex-wrap gap-2"><span className="cyvora-chip px-3 py-2 text-[10px] text-emerald-200">$0 provider</span><Link href="/companies" className="cyvora-chip inline-flex min-h-11 items-center px-4 text-sm text-cyan-100">Company Engine</Link></div></div></section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Registry agents" value={stats?.total ?? '—'} /><Metric label="Template assigned" value={stats?.assigned ?? '—'} /><Metric label="High-risk roles" value={stats?.highRisk ?? '—'} tone="amber" /><Metric label="Current results" value={agents.length} tone="emerald" /></section>

    <section className="mt-4 cyvora-glass rounded-3xl p-4"><div className="grid gap-3 md:grid-cols-[1fr_repeat(3,180px)]"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, role, capability, or tag…" className="min-h-11 rounded-xl border border-white/[0.08] bg-slate-950/45 px-4 text-sm text-white outline-none focus:border-cyan-300/25" /><Filter value={category} onChange={setCategory} options={['all', ...displayedCategories]} /><Filter value={risk} onChange={setRisk} options={['all', 'low', 'medium', 'high']} /><Filter value={source} onChange={setSource} options={['all', ...(stats?.sources || [])]} /></div></section>

    <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{agents.map((agent) => <Link key={agent.id} href={`/agents/${agent.slug}`} className="cyvora-glass rounded-3xl p-5 transition hover:-translate-y-1"><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-300/10 bg-violet-300/[0.05] text-xs font-bold text-violet-100">{agent.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</span><div className="text-right"><span className={`block text-[9px] uppercase ${agent.risk === 'high' ? 'text-amber-200' : agent.risk === 'medium' ? 'text-cyan-200' : 'text-emerald-200'}`}>{agent.risk} risk</span><span className="mt-1 block text-[9px] text-slate-600">v{agent.version}</span></div></div><p className="mt-5 text-[9px] uppercase tracking-[0.16em] text-slate-600">{agent.category} · {agent.source}</p><h2 className="mt-2 text-lg font-semibold text-white">{agent.name}</h2><p className="mt-2 line-clamp-3 text-xs leading-6 text-slate-500">{agent.summary}</p><div className="mt-4 flex flex-wrap gap-2">{agent.capabilities.slice(0, 4).map((capability) => <span key={capability} className="cyvora-chip px-2 py-1 text-[9px] text-slate-300">{capability}</span>)}</div><div className="mt-5 flex items-center justify-between text-[10px]"><span className={agent.lifecycle === 'assigned' ? 'text-emerald-200' : 'text-slate-500'}>{agent.lifecycle}</span><span className="text-cyan-200">Open profile →</span></div></Link>)}{!loading && !agents.length ? <div className="cyvora-glass col-span-full rounded-3xl border-dashed p-8 text-center text-sm text-slate-500">No agents match the current filters.</div> : null}</section>
  </main>;
}

function Metric({ label, value, tone = 'cyan' }: { label: string; value: string | number; tone?: 'cyan' | 'amber' | 'emerald' }) { return <div className="cyvora-tactile rounded-2xl p-4"><span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</span><strong className={`mt-2 block text-xl ${tone === 'amber' ? 'text-amber-200' : tone === 'emerald' ? 'text-emerald-200' : 'text-cyan-100'}`}>{value}</strong></div>; }
function Filter({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-xs capitalize text-slate-300 outline-none">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
