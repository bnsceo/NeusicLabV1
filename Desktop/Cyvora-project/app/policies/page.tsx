'use client';

import { useEffect, useMemo, useState } from 'react';

type Pack = { id: string; name: string; summary: string; autoApproveRisks: string[]; approvalRisks: string[]; blockedSideEffects: string[]; approvalSideEffects: string[]; maxAutoCostUsd: number; allowPaidAi: boolean; allowRealConnectors: boolean };
type Connector = { id: string; name: string; actions: { id: string; label: string; risk: string; sideEffect: string; reversible: boolean }[] };

export default function PoliciesPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [packId, setPackId] = useState('founder-safe');
  const [connectorId, setConnectorId] = useState('github');
  const [actionId, setActionId] = useState('create_pull_request');
  const [sensitiveData, setSensitiveData] = useState('none');
  const [founderApproved, setFounderApproved] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => Promise.all([fetch('/api/policies').then((r) => r.json()), fetch('/api/connectors').then((r) => r.json())]).then(([policyData, connectorData]) => {
    setPacks(Array.isArray(policyData.packs) ? policyData.packs : []);
    setDecisions(Array.isArray(policyData.recentDecisions) ? policyData.recentDecisions : []);
    setConnectors(Array.isArray(connectorData.connectors) ? connectorData.connectors : []);
  });
  useEffect(() => { void refresh(); }, []);

  const selectedConnector = useMemo(() => connectors.find((item) => item.id === connectorId) || connectors[0], [connectors, connectorId]);
  const actions = useMemo(() => selectedConnector?.actions || [], [selectedConnector]);
  useEffect(() => { if (selectedConnector && !actions.some((item) => item.id === actionId)) setActionId(actions[0]?.id || ''); }, [selectedConnector, actions, actionId]);
  const selectedAction = actions.find((item) => item.id === actionId);
  const activePack = useMemo(() => packs.find((pack) => pack.id === packId), [packs, packId]);

  async function evaluate() {
    setBusy(true);
    try {
      const response = await fetch('/api/policies/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ policyPackId: packId, connectorId, actionId, connectorMode: 'mock', providerMode: 'mock', estimatedCostUsd: 0, sensitiveData, actorRole: 'agent', founderApproved }) });
      setResult(await response.json());
      await refresh();
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
    <section className="cyvora-glass-strong rounded-3xl p-6 md:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[0.24em] text-violet-200/75">Phase 9 · Policy Engine</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">Governance Policies</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Every provider call and connector action receives a deterministic decision based on cost, risk, side effects, reversibility, privacy, runtime mode, and founder approval.</p></div><div className="flex flex-wrap gap-2"><span className="cyvora-chip px-3 py-2 text-[10px] text-emerald-200">Default cost limit $0</span><span className="cyvora-chip px-3 py-2 text-[10px] text-amber-200">Founder approval gates</span></div></div></section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Policy packs" value={packs.length} /><Metric label="Default pack" value="Founder Safe" /><Metric label="Paid AI" value="Blocked" /><Metric label="Real connectors" value="Blocked" /></section>

    <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_1fr]">
      <div><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Policy packs</p><h2 className="mt-2 text-2xl font-semibold text-white">Choose the operating posture</h2><div className="mt-4 space-y-4">{packs.map((pack) => <button key={pack.id} onClick={() => setPackId(pack.id)} className={`cyvora-glass w-full rounded-3xl p-5 text-left ${packId === pack.id ? 'ring-1 ring-cyan-300/25' : ''}`}><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold text-white">{pack.name}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{pack.summary}</p></div><span className="cyvora-chip px-3 py-2 text-[9px] text-violet-200">{pack.id}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Small label="Auto risks" value={pack.autoApproveRisks.join(', ') || 'none'} /><Small label="Approval" value={pack.approvalRisks.join(', ') || 'none'} /><Small label="Cost ceiling" value={`$${pack.maxAutoCostUsd}`} /></div></button>)}</div></div>

      <aside className="cyvora-glass-strong rounded-3xl p-5 xl:sticky xl:top-24 xl:self-start"><p className="text-[10px] uppercase tracking-[0.2em] text-violet-200/70">Policy simulator</p><h2 className="mt-2 text-xl font-semibold text-white">Evaluate before execution</h2><p className="mt-2 text-xs leading-6 text-slate-500">This simulator uses the same deterministic rules as the connector test bench.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Policy pack"><select value={packId} onChange={(event) => setPackId(event.target.value)} className="cyvora-select">{packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></Field><Field label="Sensitive data"><select value={sensitiveData} onChange={(event) => setSensitiveData(event.target.value)} className="cyvora-select"><option value="none">None</option><option value="internal">Internal</option><option value="personal">Personal</option><option value="financial">Financial</option><option value="regulated">Regulated</option></select></Field><Field label="Connector"><select value={connectorId} onChange={(event) => setConnectorId(event.target.value)} className="cyvora-select">{connectors.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}</option>)}</select></Field><Field label="Action"><select value={actionId} onChange={(event) => setActionId(event.target.value)} className="cyvora-select">{actions.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}</select></Field></div>
        {selectedAction ? <div className="mt-4 grid grid-cols-3 gap-2"><Small label="Risk" value={selectedAction.risk} /><Small label="Side effect" value={selectedAction.sideEffect} /><Small label="Reversible" value={selectedAction.reversible ? 'yes' : 'no'} /></div> : null}
        <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-slate-300"><input type="checkbox" checked={founderApproved} onChange={(event) => setFounderApproved(event.target.checked)} /> Simulate founder approval already granted</label>
        <button disabled={busy || !actionId} onClick={() => void evaluate()} className="mt-4 min-h-11 w-full rounded-xl bg-violet-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">Evaluate policy</button>
        {result?.decision ? <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 p-4"><div className="flex items-center justify-between gap-3"><strong className={`text-lg ${result.decision.effect === 'block' ? 'text-rose-200' : result.decision.effect === 'require_approval' ? 'text-amber-200' : 'text-emerald-200'}`}>{result.decision.effect.replaceAll('_', ' ')}</strong><span className="text-[9px] uppercase text-slate-500">decision #{result.decisionId}</span></div><p className="mt-3 text-xs leading-6 text-slate-400">{result.decision.reason}</p><div className="mt-4 flex flex-wrap gap-2">{result.decision.matchedRules.map((rule: string) => <span key={rule} className="cyvora-chip px-2 py-1 text-[8px] text-slate-400">{rule}</span>)}</div></div> : null}
        {activePack ? <p className="mt-4 text-[10px] leading-5 text-slate-600">Active posture: {activePack.summary}</p> : null}
      </aside>
    </section>

    <section className="mt-8"><p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Governance ledger</p><h2 className="mt-2 text-2xl font-semibold text-white">Recent policy decisions</h2><div className="mt-4 overflow-hidden rounded-3xl border border-white/[0.06]"><div className="divide-y divide-white/[0.05]">{decisions.map((item) => <div key={item.id} className="grid gap-2 bg-white/[0.015] p-4 text-xs md:grid-cols-[.8fr_.7fr_1fr_1.5fr]"><span className="text-violet-200">{item.policy_pack}</span><span className="text-white">{item.effect.replaceAll('_', ' ')}</span><span className="text-slate-500">{item.risk_level} · {item.side_effect}</span><span className="truncate text-slate-600">{item.reason}</span></div>)}{!decisions.length ? <p className="p-6 text-center text-sm text-slate-500">No policy decisions recorded yet.</p> : null}</div></div></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="cyvora-tactile rounded-2xl p-4"><span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</span><strong className="mt-2 block truncate text-xl text-cyan-100">{value}</strong></div>; }
function Small({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"><span className="block text-[8px] uppercase tracking-[0.14em] text-slate-600">{label}</span><strong className="mt-2 block truncate text-xs capitalize text-white">{value.replaceAll('_', ' ')}</strong></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-[10px] uppercase tracking-[0.12em] text-slate-600">{label}{children}</label>; }
