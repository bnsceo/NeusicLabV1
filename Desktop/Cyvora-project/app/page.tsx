'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

type Headquarters = {
  totals: { companies: number; departments: number; agents: number; tasks: number; approvals: number };
  activity: { id: number; title: string; description?: string; created_at: string }[];
  companies: { id: number; name: string; status: string; approvals: { status: string }[] }[];
};

type Briefing = { objective: string; status: string; agents: unknown[] };

export default function HomeLaunchpad() {
  const runtime = getRuntimeModeInfo();
  const [headquarters, setHeadquarters] = useState<Headquarters | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/headquarters').then((response) => response.json()),
      fetch('/api/briefing').then((response) => response.json()),
    ]).then(([hq, currentBriefing]) => {
      setHeadquarters(hq);
      setBriefing(currentBriefing);
    }).catch(() => undefined);
  }, []);

  const pendingApprovals = useMemo(() => headquarters?.companies.flatMap((company) => company.approvals || []).filter((approval) => approval.status === 'pending').length || 0, [headquarters]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <section className="cyvora-glass-strong rounded-3xl p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/75">Founder launchpad</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">Welcome back, Anderson.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Start a mission, review decisions, inspect your companies, or open the Executive Briefing. The launchpad stays intentionally compact.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/command-center" className="inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950">Open Command Center</Link>
            <Link href="/executive-ai" className="cyvora-chip inline-flex min-h-11 items-center px-4 text-sm text-slate-200">Ask Executive AI</Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Mode" value={runtime.label} />
        <Metric label="Companies" value={headquarters?.totals.companies ?? '—'} />
        <Metric label="Agents" value={headquarters?.totals.agents ?? '—'} />
        <Metric label="Tasks" value={headquarters?.totals.tasks ?? '—'} />
        <Metric label="Approvals" value={pendingApprovals} tone={pendingApprovals ? 'amber' : 'emerald'} />
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LaunchCard href="/command-center" eyebrow="Operate" title="Command Center" description="Founder overview, mission intake, approvals, and quick actions." />
        <LaunchCard href="/briefing" eyebrow="Understand" title="Executive Briefing" description="Objectives, risks, opportunities, blocked work, and recommendations." />
        <LaunchCard href="/companies" eyebrow="Build" title="Companies" description="Active businesses, reusable templates, and company lifecycle." />
        <LaunchCard href="/agents" eyebrow="Staff" title="Agent Registry" description="Search and inspect the reusable AI workforce." />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <article className="cyvora-glass rounded-3xl p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Current mission</p><h2 className="mt-2 text-xl font-semibold text-white">{briefing?.objective || 'No active mission'}</h2></div>
            <span className="cyvora-chip px-3 py-2 text-[10px] uppercase text-amber-200">{briefing?.status || 'pending'}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{briefing?.agents?.length ? `${briefing.agents.length} agents are attached to this briefing.` : 'Use Command Center to compose the next founder objective.'}</p>
          <div className="mt-5 flex gap-2"><Link href="/command-center" className="cyvora-chip px-4 py-2 text-sm text-cyan-100">Open mission intake</Link><Link href="/history" className="cyvora-chip px-4 py-2 text-sm text-slate-300">View history</Link></div>
        </article>

        <article className="cyvora-glass rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.2em] text-violet-200/70">Recent activity</p><h2 className="mt-2 text-xl font-semibold text-white">Latest system events</h2></div><Link href="/headquarters" className="text-xs text-cyan-200">Open HQ</Link></div>
          <div className="mt-4 space-y-3">{(headquarters?.activity || []).slice(0, 4).map((event) => <div key={event.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"><strong className="text-xs text-slate-200">{event.title}</strong><p className="mt-1 text-[10px] leading-5 text-slate-500">{event.description || 'Cyvora activity event'}</p></div>)}{!headquarters?.activity?.length ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-slate-500">No activity yet.</p> : null}</div>
        </article>
      </section>
    </main>
  );
}

function Metric({ label, value, tone = 'cyan' }: { label: string; value: string | number; tone?: 'cyan' | 'amber' | 'emerald' }) {
  const color = tone === 'amber' ? 'text-amber-200' : tone === 'emerald' ? 'text-emerald-200' : 'text-cyan-100';
  return <div className="cyvora-tactile rounded-2xl p-4"><span className="text-[9px] uppercase tracking-[0.18em] text-slate-600">{label}</span><strong className={`mt-2 block truncate text-xl ${color}`}>{value}</strong></div>;
}

function LaunchCard({ href, eyebrow, title, description }: { href: string; eyebrow: string; title: string; description: string }) {
  return <Link href={href} className="cyvora-glass group rounded-3xl p-5 transition hover:-translate-y-1 hover:border-cyan-300/15"><p className="text-[9px] uppercase tracking-[0.2em] text-cyan-200/65">{eyebrow}</p><h2 className="mt-3 text-lg font-semibold text-white">{title}</h2><p className="mt-2 text-xs leading-6 text-slate-500">{description}</p><span className="mt-5 inline-block text-xs text-cyan-200 group-hover:translate-x-1">Open →</span></Link>;
}
