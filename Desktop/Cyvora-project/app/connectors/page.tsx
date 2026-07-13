'use client';

import { useEffect, useMemo, useState } from 'react';

type Action = { id: string; label: string; description: string; risk: string; sideEffect: string; reversible: boolean };
type Connector = { id: string; name: string; category: string; summary: string; authType: string; actions: Action[]; installation: { mode: string; status: string; enabled: boolean } };
type ActionRun = { id: number; connector_id: string; action_id: string; status: string; policy_effect: string; risk_level: string; external_reference?: string; created_at: string };

type ConnectorResponse = {
  summary: { connectorCount: number; actionCount: number; mode: string; realActionsEnabled: boolean; costUsd: number };
  connectors: Connector[];
  recentActions: ActionRun[];
};

export default function ConnectorsPage() {
  const [data, setData] = useState<ConnectorResponse | null>(null);
  const [selectedConnector, setSelectedConnector] = useState('github');
  const [selectedAction, setSelectedAction] = useState('search_repositories');
  const [payload, setPayload] = useState('{"query":"cyvora"}');
  const [message, setMessage] = useState('');
  const [decision, setDecision] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const refresh = () => fetch('/api/connectors').then((response) => response.json()).then((next) => setData(next));
  useEffect(() => { void refresh(); }, []);

  const connectors = useMemo(() => data?.connectors || [], [data?.connectors]);
  const selected = useMemo(() => connectors.find((connector) => connector.id === selectedConnector) || connectors[0], [connectors, selectedConnector]);
  const actions = useMemo(() => selected?.actions || [], [selected]);

  useEffect(() => {
    if (selected && !actions.some((action) => action.id === selectedAction)) setSelectedAction(actions[0]?.id || '');
  }, [selected, actions, selectedAction]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(connectors.map((connector) => connector.category)))], [connectors]);
  const filtered = connectors.filter((connector) => {
    if (category !== 'all' && connector.category !== category) return false;
    return `${connector.name} ${connector.summary} ${connector.category}`.toLowerCase().includes(query.toLowerCase());
  });

  async function simulate(founderApproved = false) {
    setBusy(true); setMessage(''); setDecision(null);
    try {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(payload || '{}'); } catch { throw new Error('Payload must be valid JSON.'); }
      const response = await fetch('/api/connectors/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId: selectedConnector, actionId: selectedAction, payload: parsed, founderApproved, requestedBy: founderApproved ? 'founder' : 'agent' }),
      });
      const result = await response.json();
      setDecision(result);
      if (response.status === 202) setMessage('Policy paused the action for founder approval. Review the decision, then approve the mock simulation.');
      else if (!response.ok) setMessage(result.error || result.decision?.reason || 'The action was blocked.');
      else setMessage(`${result.result?.connectorName || selected?.name} action simulated at $0 cost. Reference: ${result.result?.externalReference}`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to simulate action.'); }
    finally { setBusy(false); }
  }

  async function toggleConnector(connector: Connector) {
    await fetch('/api/connectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectorId: connector.id, enabled: !connector.installation.enabled, mode: connector.installation.enabled ? 'disabled' : 'mock' }) });
    await refresh();
  }

  return <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
    <section className="cyvora-glass-strong rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/75">Phase 8 · Mock Connector Framework</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">Connectors</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">One governed catalog for every external capability. The interface matches future real adapters, but every action currently stays deterministic, simulated, reversible where possible, and free.</p></div><div className="flex flex-wrap gap-2"><span className="cyvora-chip px-3 py-2 text-[10px] text-emerald-200">Mock mode · $0</span><span className="cyvora-chip px-3 py-2 text-[10px] text-rose-200">Real actions disabled</span></div></div>
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Connectors" value={data?.summary.connectorCount || 0} /><Metric label="Governed actions" value={data?.summary.actionCount || 0} /><Metric label="Runtime mode" value="Mock" /><Metric label="API cost" value="$0" tone="emerald" /></section>

    <section className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <div><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.2em] text-violet-200/70">Capability catalog</p><h2 className="mt-2 text-2xl font-semibold text-white">Available mock adapters</h2></div><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search connectors…" className="min-h-10 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-white outline-none" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-10 rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-xs text-slate-300 outline-none">{categories.map((item) => <option key={item}>{item}</option>)}</select></div></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{filtered.map((connector) => <article key={connector.id} className={`cyvora-glass rounded-3xl p-5 ${selectedConnector === connector.id ? 'ring-1 ring-cyan-300/25' : ''}`}><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{connector.category}</p><h3 className="mt-2 text-lg font-semibold text-white">{connector.name}</h3></div><span className={`cyvora-chip px-3 py-2 text-[9px] ${connector.installation.enabled ? 'text-emerald-200' : 'text-slate-500'}`}>{connector.installation.enabled ? 'enabled' : 'disabled'}</span></div><p className="mt-3 text-xs leading-6 text-slate-500">{connector.summary}</p><div className="mt-4 flex items-center justify-between text-[10px] text-slate-600"><span>{connector.actions.length} actions</span><span>{connector.authType.replaceAll('_', ' ')}</span></div><div className="mt-5 flex gap-2"><button onClick={() => { setSelectedConnector(connector.id); setSelectedAction(connector.actions[0]?.id || ''); }} className="cyvora-chip min-h-10 flex-1 px-3 text-xs text-cyan-100">Test actions</button><button onClick={() => void toggleConnector(connector)} className="cyvora-chip min-h-10 px-3 text-xs text-slate-300">{connector.installation.enabled ? 'Disable' : 'Enable'}</button></div></article>)}</div>
      </div>

      <aside className="cyvora-glass-strong rounded-3xl p-5 xl:sticky xl:top-24 xl:self-start"><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Action simulator</p><h2 className="mt-2 text-xl font-semibold text-white">Policy-gated test bench</h2><p className="mt-2 text-xs leading-6 text-slate-500">Choose an action. Low-risk reads simulate immediately. Consequential actions pause for founder approval.</p>
        <label className="mt-5 block text-[10px] uppercase text-slate-600">Connector<select value={selectedConnector} onChange={(event) => setSelectedConnector(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white">{connectors.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}</option>)}</select></label>
        <label className="mt-4 block text-[10px] uppercase text-slate-600">Action<select value={selectedAction} onChange={(event) => setSelectedAction(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white">{actions.map((action) => <option key={action.id} value={action.id}>{action.label} · {action.risk}</option>)}</select></label>
        <label className="mt-4 block text-[10px] uppercase text-slate-600">Mock payload<textarea value={payload} onChange={(event) => setPayload(event.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-slate-950 p-3 font-mono text-xs text-slate-300 outline-none" /></label>
        <button disabled={busy || !selectedAction} onClick={() => void simulate(false)} className="mt-4 min-h-11 w-full rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">Evaluate and simulate</button>
        {decision?.status === 'awaiting_approval' ? <button disabled={busy} onClick={() => void simulate(true)} className="mt-2 min-h-11 w-full rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-semibold text-amber-100">Founder approve mock action</button> : null}
        {message ? <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs leading-6 text-slate-300">{message}</p> : null}
        {decision?.decision ? <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/15 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{decision.decision.effect.replaceAll('_', ' ')}</strong><span className="text-[9px] uppercase text-violet-200">{decision.decision.policyPack}</span></div><p className="mt-2 text-xs leading-6 text-slate-500">{decision.decision.reason}</p><div className="mt-3 flex flex-wrap gap-2">{decision.decision.matchedRules.map((rule: string) => <span key={rule} className="cyvora-chip px-2 py-1 text-[8px] text-slate-400">{rule}</span>)}</div></div> : null}
      </aside>
    </section>

    <section className="mt-8"><p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Audit stream</p><h2 className="mt-2 text-2xl font-semibold text-white">Recent connector actions</h2><div className="mt-4 overflow-hidden rounded-3xl border border-white/[0.06]"><div className="divide-y divide-white/[0.05]">{(data?.recentActions || []).map((run) => <div key={run.id} className="grid gap-2 bg-white/[0.015] p-4 text-xs md:grid-cols-[1fr_1fr_.7fr_.8fr]"><span className="text-white">{run.connector_id} · {run.action_id}</span><span className="text-slate-500">{run.policy_effect.replaceAll('_', ' ')}</span><span className="text-cyan-200">{run.status}</span><span className="truncate text-slate-600">{run.external_reference || new Date(run.created_at).toLocaleString()}</span></div>)}{!data?.recentActions?.length ? <p className="p-6 text-center text-sm text-slate-500">No connector actions have been simulated yet.</p> : null}</div></div></section>
  </main>;
}

function Metric({ label, value, tone = 'cyan' }: { label: string; value: string | number; tone?: 'cyan' | 'emerald' }) { return <div className="cyvora-tactile rounded-2xl p-4"><span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</span><strong className={`mt-2 block truncate text-xl ${tone === 'emerald' ? 'text-emerald-200' : 'text-cyan-100'}`}>{value}</strong></div>; }
