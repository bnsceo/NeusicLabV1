'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

type Company = { id: number; name: string; description: string; brand_color: string; status: string; created_at: string };
type CompanyTemplate = { id: string; version: string; category: string; name: string; summary: string; description: string; brandColor: string; lifecycle: string; departmentCount: number; agentCount: number; taskCount: number; connectorCount: number; estimatedMonthlyCost: number };

export default function CompaniesPage() {
  const runtime = getRuntimeModeInfo();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<CompanyTemplate[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<CompanyTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = () => Promise.all([
    fetch('/api/companies').then((response) => response.json()),
    fetch('/api/company-templates').then((response) => response.json()),
  ]).then(([companyData, templateData]) => {
    setCompanies(Array.isArray(companyData) ? companyData : []);
    setTemplates(Array.isArray(templateData?.templates) ? templateData.templates : []);
  }).catch(() => undefined);

  useEffect(() => { void refresh(); }, []);

  const categories = useMemo(() => ['all', ...Array.from(new Set(templates.map((template) => template.category)))], [templates]);
  const filtered = templates.filter((template) => {
    if (category !== 'all' && template.category !== category) return false;
    const haystack = `${template.name} ${template.description} ${template.summary} ${template.category}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  async function instantiate(template: CompanyTemplate) {
    setCreating(true); setMessage('');
    try {
      const response = await fetch('/api/company-engine/instantiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: template.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create company.');
      setMessage(`${data.blueprint.company.name} created from ${data.templateId} v${data.templateVersion} at $0 API cost.`);
      setSelected(null);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create company.'); }
    finally { setCreating(false); }
  }

  return <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
    <section className="cyvora-glass-strong rounded-3xl p-6 md:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/75">Phase 6 · Company Engine</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">Companies</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Active companies and reusable operating templates now live together. Templates create departments, teams, agents, tasks, mock connectors, policies, KPIs, and approvals.</p></div><div className="flex flex-wrap gap-2"><span className="cyvora-chip px-3 py-2 text-[10px] text-emerald-200">Provider cost $0</span><Link href="/command-center" className="cyvora-chip inline-flex min-h-11 items-center px-4 text-sm text-cyan-100">Mission intake</Link></div></div></section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active companies" value={companies.length} /><Metric label="Templates" value={templates.length} /><Metric label="Runtime mode" value={runtime.label} /><Metric label="Template cost" value="$0" tone="emerald" /></section>

    {message ? <p className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-3 text-xs text-cyan-100">{message}</p> : null}

    <section className="mt-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Operating portfolio</p><h2 className="mt-2 text-2xl font-semibold text-white">Active companies</h2></div><Link href="/headquarters" className="text-xs text-cyan-200">Open organization map →</Link></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.map((company) => <Link key={company.id} href={`/companies/${company.id}`} className="cyvora-glass rounded-3xl p-5 transition hover:-translate-y-1"><div className="flex items-start justify-between gap-4"><span className="h-11 w-11 rounded-2xl ring-1 ring-white/10" style={{ backgroundColor: company.brand_color || '#38bdf8' }} /><span className="cyvora-chip px-3 py-2 text-[9px] uppercase text-emerald-200">{company.status}</span></div><h3 className="mt-5 text-lg font-semibold text-white">{company.name}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{company.description}</p><span className="mt-5 inline-block text-xs text-cyan-200">Open company →</span></Link>)}{!companies.length ? <div className="cyvora-glass col-span-full rounded-3xl border-dashed p-8 text-center text-sm text-slate-500">No active companies yet. Instantiate a template below.</div> : null}</div></section>

    <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-violet-200/70">Template registry</p><h2 className="mt-2 text-2xl font-semibold text-white">Reusable company operating models</h2></div><div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates…" className="min-h-10 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-white outline-none" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-10 rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-xs text-slate-300 outline-none">{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((template) => <article key={template.id} className="cyvora-glass rounded-3xl p-5"><div className="flex items-start justify-between gap-4"><span className="h-11 w-11 rounded-2xl ring-1 ring-white/10" style={{ backgroundColor: template.brandColor }} /><div className="text-right"><span className="block text-[9px] uppercase text-violet-200">v{template.version}</span><span className="mt-1 block text-[9px] text-emerald-200">$0 mock</span></div></div><p className="mt-5 text-[9px] uppercase tracking-[0.16em] text-slate-600">{template.category}</p><h3 className="mt-2 text-lg font-semibold text-white">{template.name}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{template.description}</p><div className="mt-4 grid grid-cols-4 gap-2"><Small label="Depts" value={template.departmentCount} /><Small label="Agents" value={template.agentCount} /><Small label="Tasks" value={template.taskCount} /><Small label="Links" value={template.connectorCount} /></div><div className="mt-5 flex gap-2"><button onClick={() => setSelected(template)} className="cyvora-chip min-h-10 flex-1 px-3 text-xs text-slate-200">Inspect</button><button disabled={creating || runtime.readOnlyDemo} onClick={() => void instantiate(template)} className="min-h-10 flex-1 rounded-xl bg-cyan-300 px-3 text-xs font-semibold text-slate-950 disabled:opacity-50">Create</button></div></article>)}</div>
    </section>

    {selected ? <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/75 p-3 backdrop-blur md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="cyvora-glass-strong max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-violet-200/70">Company template</p><h2 className="mt-2 text-2xl font-semibold text-white">{selected.name}</h2></div><button onClick={() => setSelected(null)} className="cyvora-shell-icon-button">×</button></div><p className="mt-4 text-sm leading-7 text-slate-400">{selected.summary}</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Departments" value={selected.departmentCount} /><Metric label="Agents" value={selected.agentCount} /><Metric label="Tasks" value={selected.taskCount} /><Metric label="Cost" value="$0" tone="emerald" /></div><button disabled={creating || runtime.readOnlyDemo} onClick={() => void instantiate(selected)} className="mt-5 min-h-11 w-full rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">Instantiate company</button></section></div> : null}
  </main>;
}

function Metric({ label, value, tone = 'cyan' }: { label: string; value: string | number; tone?: 'cyan' | 'emerald' }) { return <div className="cyvora-tactile rounded-2xl p-4"><span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</span><strong className={`mt-2 block truncate text-xl ${tone === 'emerald' ? 'text-emerald-200' : 'text-cyan-100'}`}>{value}</strong></div>; }
function Small({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2 text-center"><span className="block text-[8px] uppercase text-slate-600">{label}</span><strong className="mt-1 block text-sm text-white">{value}</strong></div>; }
