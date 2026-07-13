'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

type Approval = { id: number; company_id: number; title: string; summary?: string; status: string; risk_level: string; approval_type?: string };
type Headquarters = {
  totals: { companies: number; departments: number; agents: number; tasks: number; approvals: number };
  companies: { id: number; name: string; approvals: Approval[] }[];
};
type Blueprint = { archetype: string; company: { name: string; description: string }; departments: { teams: { agents: unknown[] }[] }[]; tasks: unknown[]; approvals: unknown[]; connectors: unknown[]; estimatedMonthlyCost: number };

const templateMap: Record<string, string> = { content: 'content-studio', software: 'software-lab', marketplace: 'marketplace-division', investment: 'investment-company', consulting: 'consulting-group' };

export default function CommandCenterPage() {
  const runtime = getRuntimeModeInfo();
  const [headquarters, setHeadquarters] = useState<Headquarters | null>(null);
  const [objective, setObjective] = useState('I want to build a YouTube business focused on practical AI tools for small business owners.');
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [compact, setCompact] = useState(false);
  const [approvalEmphasis, setApprovalEmphasis] = useState(true);

  const refresh = () => fetch('/api/headquarters').then((response) => response.json()).then(setHeadquarters).catch(() => undefined);
  useEffect(() => { void refresh(); }, []);

  const approvals = useMemo(() => headquarters?.companies.flatMap((company) => company.approvals.map((approval) => ({ ...approval, companyName: company.name }))).filter((approval) => approval.status === 'pending') || [], [headquarters]);
  const agentCount = blueprint?.departments.reduce((total, department) => total + department.teams.reduce((teamTotal, team) => teamTotal + team.agents.length, 0), 0) || 0;

  async function previewMission() {
    if (!objective.trim()) return;
    setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/executive-ai/blueprint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objective }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to generate blueprint.');
      setBlueprint(data.blueprint);
      setMessage('Blueprint generated at $0 API cost. Review it before creating the company.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to generate blueprint.'); }
    finally { setLoading(false); }
  }

  async function launchBlueprint() {
    if (!blueprint) return;
    const templateId = templateMap[blueprint.archetype] || 'content-studio';
    setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/company-engine/instantiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId, objective, companyName: blueprint.company.name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create company.');
      setMessage(`${data.blueprint.company.name} was created from ${data.templateId} v${data.templateVersion}.`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create company.'); }
    finally { setLoading(false); }
  }

  async function decideApproval(id: number, action: 'approve' | 'hold') {
    const response = await fetch(`/api/approvals/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const data = await response.json();
    setMessage(response.ok ? `Approval ${action === 'approve' ? 'approved' : 'held'}.` : data.error || 'Approval update failed.');
    if (response.ok) await refresh();
  }

  return <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
    <section className="cyvora-glass-strong rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/75">Founder workflow</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">Command Center</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">System mode, founder overview, mission intake, approval queue, and quick actions—without operational clutter.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/briefing" className="cyvora-chip inline-flex min-h-11 items-center px-4 text-sm text-violet-100">Executive Briefing</Link><button onClick={() => setShowControls((value) => !value)} className="cyvora-chip min-h-11 px-4 text-sm text-slate-200">{showControls ? 'Hide controls' : 'Show controls'}</button></div>
      </div>
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="System Mode" value={runtime.label} />
      <Metric label="Companies" value={headquarters?.totals.companies ?? '—'} />
      <Metric label="Departments" value={headquarters?.totals.departments ?? '—'} />
      <Metric label="Agents" value={headquarters?.totals.agents ?? '—'} />
      <Metric label="Approvals" value={approvals.length} tone={approvals.length ? 'amber' : 'emerald'} />
    </section>

    {showControls ? <section className="mt-4 cyvora-glass rounded-3xl p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Control panel</p><h2 className="mt-2 text-lg font-semibold text-white">Founder display preferences</h2></div><span className="text-xs text-slate-600">Hidden by default</span></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Toggle label="Compact mission preview" checked={compact} onChange={() => setCompact((value) => !value)} /><Toggle label="Emphasize approvals" checked={approvalEmphasis} onChange={() => setApprovalEmphasis((value) => !value)} /></div></section> : null}

    <section className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
      <article className="cyvora-glass rounded-3xl p-5 md:p-6">
        <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/70">Mission intake</p><h2 className="mt-2 text-2xl font-semibold text-white">State the business outcome once</h2><p className="mt-2 text-sm leading-6 text-slate-500">The mock Executive AI and Company Engine turn it into an approval-aware operating company.</p>
        <textarea value={objective} onChange={(event) => { setObjective(event.target.value); setBlueprint(null); }} rows={compact ? 3 : 6} className="mt-5 w-full resize-y rounded-2xl border border-white/[0.08] bg-slate-950/55 p-4 text-sm leading-6 text-white outline-none focus:border-cyan-300/35" />
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={loading || !objective.trim()} onClick={() => void previewMission()} className="min-h-11 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{loading ? 'Working…' : 'Preview blueprint'}</button>{blueprint ? <button disabled={loading || runtime.readOnlyDemo} onClick={() => void launchBlueprint()} className="cyvora-chip min-h-11 px-4 text-sm text-emerald-100 disabled:opacity-50">Create company</button> : null}</div>
        {message ? <p className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-3 text-xs leading-5 text-cyan-100">{message}</p> : null}
        {blueprint ? <div className="mt-5 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] uppercase tracking-[0.18em] text-violet-200/70">Blueprint preview</p><h3 className="mt-2 text-xl font-semibold text-white">{blueprint.company.name}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{blueprint.company.description}</p></div><span className="cyvora-chip px-3 py-2 text-[9px] text-emerald-200">$0</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Small label="Departments" value={blueprint.departments.length} /><Small label="Agents" value={agentCount} /><Small label="Tasks" value={blueprint.tasks.length} /><Small label="Approvals" value={blueprint.approvals.length} /><Small label="Connectors" value={blueprint.connectors.length} /></div></div> : null}
      </article>

      <article className={`cyvora-glass rounded-3xl p-5 md:p-6 ${approvalEmphasis && approvals.length ? 'ring-1 ring-amber-300/20' : ''}`}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/70">Approval queue</p><h2 className="mt-2 text-2xl font-semibold text-white">Founder decisions</h2></div><span className="cyvora-chip px-3 py-2 text-[10px] text-amber-200">{approvals.length} pending</span></div>
        <div className="mt-5 space-y-3">{approvals.slice(0, 8).map((approval) => <div key={approval.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-white">{approval.title}</strong><p className="mt-1 text-[10px] text-slate-500">{approval.companyName} · {approval.risk_level} risk</p></div><span className="text-[9px] uppercase text-amber-200">{approval.approval_type || 'task'}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{approval.summary || 'Review the requested action before execution.'}</p><div className="mt-3 flex gap-2"><button onClick={() => void decideApproval(approval.id, 'approve')} className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950">Approve</button><button onClick={() => void decideApproval(approval.id, 'hold')} className="cyvora-chip px-3 py-2 text-xs text-slate-300">Hold</button></div></div>)}{!approvals.length ? <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">All clear. No founder decisions are pending.</div> : null}</div>
      </article>
    </section>

    <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Quick href="/executive-ai" title="Executive AI" text="Generate and inspect structured business blueprints." /><Quick href="/companies" title="Company Engine" text="Browse reusable operating templates and active companies." /><Quick href="/agents" title="Agent Registry" text="Search the reusable AI workforce." /><Quick href="/headquarters" title="Headquarters" text="Inspect organization depth and live operations." /></section>
  </main>;
}

function Metric({ label, value, tone = 'cyan' }: { label: string; value: string | number; tone?: 'cyan' | 'amber' | 'emerald' }) { return <div className="cyvora-tactile rounded-2xl p-4"><span className="text-[9px] uppercase tracking-[0.18em] text-slate-600">{label}</span><strong className={`mt-2 block truncate text-xl ${tone === 'amber' ? 'text-amber-200' : tone === 'emerald' ? 'text-emerald-200' : 'text-cyan-100'}`}>{value}</strong></div>; }
function Small({ label, value }: { label: string; value: string | number }) { return <div className="cyvora-tactile rounded-xl p-3"><span className="block text-[8px] uppercase tracking-[0.14em] text-slate-600">{label}</span><strong className="mt-1 block text-lg text-white">{value}</strong></div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <button type="button" onClick={onChange} className="cyvora-tactile flex min-h-14 items-center justify-between rounded-2xl p-4 text-left"><span className="text-sm text-slate-200">{label}</span><span className={`h-6 w-11 rounded-full p-1 ${checked ? 'bg-cyan-300/30' : 'bg-white/[0.06]'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} /></span></button>; }
function Quick({ href, title, text }: { href: string; title: string; text: string }) { return <Link href={href} className="cyvora-glass rounded-3xl p-5 transition hover:-translate-y-1"><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p><span className="mt-4 inline-block text-xs text-cyan-200">Open →</span></Link>; }
