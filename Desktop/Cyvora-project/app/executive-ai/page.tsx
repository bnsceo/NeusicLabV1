'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ExecutiveBlueprint } from '@/lib/executiveBlueprint';

const presets = [
  'Create an investment company for research, portfolio monitoring, compliance, risk, finance, operations, and legal.',
  'Build a YouTube content company for practical AI tools for small business owners.',
  'Create a software lab that builds and maintains Cyvora products.',
  'Build a marketplace division for digital products and print-on-demand experiments.',
  'Create a consulting group serving small businesses with AI automation strategy.',
];

type Tab = 'overview' | 'organization' | 'work' | 'roadmap';

export default function ExecutiveAIPage() {
  const [objective, setObjective] = useState(presets[0]);
  const [blueprint, setBlueprint] = useState<ExecutiveBlueprint | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  async function generate(nextObjective = objective) {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/executive-ai/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: nextObjective }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Blueprint generation failed.');
      setBlueprint(data.blueprint);
      setTab('overview');
    } catch (error: any) {
      setMessage(error.message || 'Blueprint generation failed.');
    } finally {
      setLoading(false);
    }
  }

  async function createCompany() {
    if (!blueprint) return;
    const templateMap: Record<string, string> = { content: 'content-studio', software: 'software-lab', marketplace: 'marketplace-division', investment: 'investment-company', consulting: 'consulting-group' };
    const templateId = templateMap[blueprint.archetype] || 'content-studio';
    setCreating(true);
    setMessage('');
    try {
      const response = await fetch('/api/company-engine/instantiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, objective: blueprint.objective, companyName: blueprint.company.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Company creation failed.');
      setMessage(`${data.blueprint?.company?.name || blueprint.company.name} was created from ${data.templateId} v${data.templateVersion}.`);
    } catch (error: any) {
      setMessage(error.message || 'Company creation failed.');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void generate(presets[0]);
    // The initial blueprint is intentionally generated once from a deterministic preset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    if (!blueprint) return { departments: 0, teams: 0, agents: 0, tasks: 0 };
    return {
      departments: blueprint.departments.length,
      teams: blueprint.departments.reduce((sum, department) => sum + department.teams.length, 0),
      agents: blueprint.departments.reduce((sum, department) => sum + department.teams.reduce((teamSum, team) => teamSum + team.agents.length, 0), 0),
      tasks: blueprint.tasks.length,
    };
  }, [blueprint]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="cyvora-glass-strong overflow-hidden rounded-[2rem] p-5 sm:p-7">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)] xl:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="cyvora-chip px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-violet-200">Executive AI · Mocked</span>
                <span className="cyvora-chip px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-emerald-200">$0 provider cost</span>
                <span className="cyvora-chip px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-cyan-200">Deterministic templates</span>
              </div>
              <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Founder intent → business operating system</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">Describe the company. Cyvora designs the operating blueprint.</h1>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-400">No paid model is called. Executive AI selects a deterministic archetype and returns departments, teams, agents, tasks, connectors, approvals, KPIs, risks, and a phased roadmap.</p>

              <div className="mt-7 rounded-2xl border border-violet-300/10 bg-violet-300/[0.025] p-4 shadow-[inset_7px_7px_16px_rgba(0,0,0,.3),inset_-5px_-5px_12px_rgba(255,255,255,.015)]">
                <textarea value={objective} onChange={(event) => setObjective(event.target.value)} className="min-h-32 w-full resize-y bg-transparent text-base leading-7 text-white outline-none placeholder:text-slate-600" placeholder="Example: Create an investment company…" />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                  <span className="text-[10px] text-slate-600">{objective.length}/3000 · Mock provider · Mock connectors</span>
                  <button disabled={loading || !objective.trim()} onClick={() => void generate()} className="cyvora-tactile min-h-11 rounded-xl px-5 text-sm font-semibold text-cyan-50 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Designing blueprint…' : 'Generate blueprint'}</button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">{presets.map((preset) => <button key={preset} onClick={() => { setObjective(preset); void generate(preset); }} className="cyvora-chip max-w-full truncate px-3 py-2 text-left text-[10px] text-slate-400 transition hover:text-white">{preset.replace(/^Create |^Build /, '')}</button>)}</div>
            </div>

            <div className="cyvora-glass rounded-3xl p-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-violet-200/75">Blueprint summary</p>
              {blueprint ? <>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div><h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">{blueprint.company.name}</h2><p className="mt-2 text-xs leading-6 text-slate-400">{blueprint.company.positioning}</p></div>
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: blueprint.company.brandColor, boxShadow: `0 0 22px ${blueprint.company.brandColor}66` }} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
                  {[['Departments', totals.departments], ['Teams', totals.teams], ['Agents', totals.agents], ['First tasks', totals.tasks]].map(([label, value]) => <div key={label} className="cyvora-tactile rounded-2xl p-4"><span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</span><strong className="mt-2 block text-2xl text-white">{value}</strong></div>)}
                </div>
                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-xs leading-6 text-slate-300">{blueprint.executiveSummary}</p></div>
                <div className="mt-5 flex flex-wrap gap-2"><button disabled={creating} onClick={() => void createCompany()} className="min-h-11 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50">{creating ? 'Creating…' : 'Create company'}</button><Link href="/headquarters" className="cyvora-chip inline-flex min-h-11 items-center px-4 text-sm text-slate-200">Open Headquarters</Link></div>
              </> : <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white/[0.025]" />}
            </div>
          </div>
        </section>

        {message ? <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] px-4 py-3 text-sm text-cyan-100">{message}</div> : null}

        {blueprint ? <>
          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Blueprint views">{(['overview', 'organization', 'work', 'roadmap'] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`min-h-10 whitespace-nowrap rounded-xl px-4 text-xs font-semibold capitalize ${tab === item ? 'cyvora-neumo-pressed text-cyan-100' : 'cyvora-chip text-slate-500 hover:text-white'}`}>{item === 'work' ? 'Tasks & approvals' : item}</button>)}</nav>

          {tab === 'overview' ? <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="cyvora-glass rounded-3xl p-5"><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/70">Company thesis</p><h2 className="mt-3 text-xl font-semibold text-white">{blueprint.company.description}</h2><p className="mt-4 text-sm leading-7 text-slate-400">Objective: {blueprint.objective}</p><div className="mt-5 flex flex-wrap gap-2"><span className="cyvora-chip px-3 py-2 text-[10px] text-emerald-200">Provider: mock</span><span className="cyvora-chip px-3 py-2 text-[10px] text-emerald-200">Connectors: mock</span><span className="cyvora-chip px-3 py-2 text-[10px] text-cyan-200">Estimated monthly cost: $0</span></div></article>
            <article className="cyvora-glass rounded-3xl p-5"><p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/70">KPIs</p><div className="mt-4 space-y-3">{blueprint.kpis.map((kpi) => <div key={kpi.name} className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div><strong className="text-sm text-white">{kpi.name}</strong><p className="mt-1 text-xs text-slate-500">{kpi.cadence}</p></div><span className="text-right text-xs text-emerald-200">{kpi.target}</span></div>)}</div></article>
            <article className="cyvora-glass rounded-3xl p-5"><p className="text-[10px] uppercase tracking-[0.22em] text-violet-200/70">Mock connectors</p><div className="mt-4 space-y-3">{blueprint.connectors.map((connector) => <div key={connector.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{connector.name}</strong><span className="cyvora-chip px-2 py-1 text-[9px] uppercase text-cyan-200">{connector.mode}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{connector.purpose}</p></div>)}</div></article>
            <article className="cyvora-glass rounded-3xl p-5"><p className="text-[10px] uppercase tracking-[0.22em] text-rose-200/70">Risks and mitigations</p><div className="mt-4 space-y-3">{blueprint.risks.map((risk) => <div key={risk.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-center justify-between"><strong className="text-sm text-white">{risk.title}</strong><span className="text-[9px] uppercase tracking-[0.14em] text-amber-200">{risk.severity}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{risk.mitigation}</p></div>)}</div></article>
          </section> : null}

          {tab === 'organization' ? <section className="mt-4 space-y-4">{blueprint.departments.map((department) => <article key={department.name} className="cyvora-glass rounded-3xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Department</p><h2 className="mt-2 text-xl font-semibold text-white">{department.name}</h2><p className="mt-2 text-xs leading-6 text-slate-500">{department.purpose}</p></div><span className="cyvora-chip px-3 py-2 text-[10px] text-slate-300">{department.teams.reduce((sum, team) => sum + team.agents.length, 0)} agents</span></div><div className="mt-5 grid gap-3 md:grid-cols-2">{department.teams.map((team) => <div key={team.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><strong className="text-sm text-white">{team.name}</strong><p className="mt-2 text-xs leading-5 text-slate-500">{team.purpose}</p><div className="mt-4 space-y-2">{team.agents.map((agent) => <div key={agent.name} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-slate-950/20 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-300/[0.07] text-[10px] font-bold text-violet-200">{agent.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</span><div><strong className="text-xs text-slate-200">{agent.name}</strong><p className="mt-1 text-[10px] leading-4 text-slate-600">{agent.role}</p></div></div>)}</div></div>)}</div></article>)}</section> : null}

          {tab === 'work' ? <section className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><article className="cyvora-glass rounded-3xl p-5"><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/70">Initial work queue</p><div className="mt-4 space-y-3">{blueprint.tasks.map((task, index) => <div key={task.title} className="grid gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/[0.06] text-xs font-semibold text-cyan-200">{String(index + 1).padStart(2, '0')}</span><div><strong className="text-sm text-white">{task.title}</strong><p className="mt-1 text-[10px] text-slate-500">{task.department} · {task.owner} · {task.stage}</p></div><span className={`cyvora-chip px-3 py-2 text-[9px] uppercase ${task.approvalRequired ? 'text-amber-200' : 'text-emerald-200'}`}>{task.approvalRequired ? 'Approval' : 'Auto mock'}</span></div>)}</div></article><article className="cyvora-glass rounded-3xl p-5"><p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/70">Founder approvals</p><div className="mt-4 space-y-3">{blueprint.approvals.map((approval) => <div key={approval.title} className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.025] p-4"><div className="flex items-start justify-between gap-3"><strong className="text-sm text-white">{approval.title}</strong><span className="text-[9px] uppercase text-amber-200">{approval.risk}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{approval.reason}</p></div>)}</div></article></section> : null}

          {tab === 'roadmap' ? <section className="mt-4 grid gap-4 lg:grid-cols-3">{blueprint.roadmap.map((phase, index) => <article key={phase.phase} className="cyvora-glass rounded-3xl p-5"><span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.05] text-sm font-semibold text-cyan-200">{index + 1}</span><p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-violet-200/70">{phase.phase}</p><h2 className="mt-2 text-lg font-semibold text-white">{phase.objective}</h2><div className="mt-4 space-y-2">{phase.outputs.map((output) => <div key={output} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">{output}</div>)}</div></article>)}</section> : null}
        </> : null}
      </div>
    </main>
  );
}
