import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgentBySlug } from '@/lib/agentRegistry';

export const dynamic = 'force-dynamic';

export default async function AgentProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = getAgentBySlug(slug);
  if (!agent) notFound();

  return <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 lg:px-8">
    <section className="cyvora-glass-strong rounded-3xl p-6 md:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-4"><span className="grid h-16 w-16 place-items-center rounded-3xl border border-violet-300/10 bg-violet-300/[0.06] text-lg font-bold text-violet-100">{agent.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</span><div><p className="text-[10px] uppercase tracking-[0.22em] text-violet-200/70">Agent profile</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">{agent.name}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{agent.summary}</p></div></div><Link href="/agents" className="cyvora-chip inline-flex min-h-11 items-center px-4 text-sm text-cyan-100">Back to registry</Link></div></section>
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Version" value={agent.version} /><Metric label="Lifecycle" value={agent.lifecycle} tone="emerald" /><Metric label="Provider" value={agent.provider} /><Metric label="Risk" value={agent.risk} tone={agent.risk === 'high' ? 'amber' : 'cyan'} /><Metric label="Cost" value={agent.costProfile} tone="emerald" /></section>
    <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><article className="cyvora-glass rounded-3xl p-5 md:p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Role and capabilities</p><h2 className="mt-2 text-xl font-semibold text-white">{agent.role}</h2><div className="mt-5 flex flex-wrap gap-2">{agent.capabilities.map((item) => <span key={item} className="cyvora-chip px-3 py-2 text-xs text-cyan-100">{item}</span>)}</div><div className="mt-6"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Tags</p><div className="mt-3 flex flex-wrap gap-2">{agent.tags.map((tag) => <span key={tag} className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[10px] text-slate-400">{tag}</span>)}</div></div></article><article className="cyvora-glass rounded-3xl p-5 md:p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-violet-200/70">Registry metadata</p><div className="mt-4 space-y-3"><Row label="Category" value={agent.category} /><Row label="Source" value={agent.source} /><Row label="Source file" value={agent.sourcePath} /><Row label="Registry ID" value={agent.id} /></div></article></section>
    <section className="mt-4 cyvora-glass rounded-3xl p-5 md:p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Company-template assignments</p><div className="mt-4 flex flex-wrap gap-3">{agent.assignedTemplates.length ? agent.assignedTemplates.map((template) => <Link key={template} href="/companies" className="cyvora-chip px-4 py-3 text-sm text-emerald-100">{template}</Link>) : <p className="text-sm text-slate-500">This agent is available but not assigned to a core company template yet.</p>}</div></section>
  </main>;
}

function Metric({ label, value, tone = 'cyan' }: { label: string; value: string; tone?: 'cyan' | 'amber' | 'emerald' }) { return <div className="cyvora-tactile rounded-2xl p-4"><span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</span><strong className={`mt-2 block truncate text-sm ${tone === 'amber' ? 'text-amber-200' : tone === 'emerald' ? 'text-emerald-200' : 'text-cyan-100'}`}>{value}</strong></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><span className="text-[9px] uppercase tracking-[0.14em] text-slate-600">{label}</span><strong className="mt-2 block break-all text-xs text-slate-200">{value}</strong></div>; }
