'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildHarnessPlan, type HarnessPlan } from '@/lib/harnessPlan';
import { clearDemoClientState, reloadFreshDemoPage } from '@/lib/demoClient';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

type BuildStage = {
  name: string;
  owner: string;
  status: 'complete' | 'active' | 'waiting' | 'locked';
  detail: string;
};

type SelfCodingRequest = {
  id: number;
  request: string;
  status: string;
  stage: string;
  approval_state: 'pending' | 'approved' | 'held';
  assigned_agents: { name: string; role: string }[];
  qa_confidence: number;
  qa_summary: string;
  dissent: string;
  created_at: string;
  updated_at: string;
  runtime_plan?: HarnessPlan;
};

const defaultRequest =
  'Add a Headquarters View where the Executive AI expands companies into departments, teams, agents, tasks, connectors, and approvals through Harness Engineering and Loop Engineering.';

const workers = [
  ['Software Architect', 'Maps the change to the existing app structure'],
  ['UX Architect', 'Defines the interaction model and progressive disclosure'],
  ['Frontend Developer', 'Builds React screens and polished UI states'],
  ['Backend Architect', 'Designs routes, persistence, and integrations'],
  ['Database Optimizer', 'Reviews schema changes and history tracking'],
  ['Security Auditor', 'Checks permissions, secrets, and risky operations'],
  ['QA Board by duh', 'Runs consensus review before approval'],
  ['DevOps Automator', 'Prepares branch, build, and deployment handoff'],
];

function getPlan(request: string): BuildStage[] {
  const cleanRequest = request.trim() || defaultRequest;

  return [
    {
      name: 'PLAN',
      owner: 'AGENT-ZERO',
      status: 'complete',
      detail: `Task contract created for: "${cleanRequest}"`,
    },
    {
      name: 'BUILD',
      owner: 'agency-agents',
      status: 'active',
      detail: 'Specialist agents are assigned to UI, backend, data, and product behavior.',
    },
    {
      name: 'HARNESS',
      owner: 'Harness Engineer',
      status: 'waiting',
      detail: 'Sandbox boundaries, permissions, and runtime controls are prepared before execution.',
    },
    {
      name: 'VALIDATE',
      owner: 'Validation Agent',
      status: 'waiting',
      detail: 'Deterministic checks, tests, and diff review validate the output before approval.',
    },
    {
      name: 'APPROVAL',
      owner: 'Human Founder',
      status: 'locked',
      detail: 'No merge, deploy, or business-critical action happens without your authorization.',
    },
    {
      name: 'DOCS',
      owner: 'Memory Bank',
      status: 'locked',
      detail: 'The final decision, rationale, cost, dissent, and outcome are stored for recall.',
    },
  ];
}

export default function SelfCodingPage() {
  const runtimeInfo = getRuntimeModeInfo();
  const isDemoModeActive = runtimeInfo.mode === 'demo';
  const [request, setRequest] = useState(defaultRequest);
  const [submittedRequest, setSubmittedRequest] = useState(defaultRequest);
  const [approvalState, setApprovalState] = useState<'pending' | 'approved' | 'held'>('pending');
  const [requests, setRequests] = useState<SelfCodingRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [planAcknowledged, setPlanAcknowledged] = useState(false);

  const selectedRequest = requests.find((item) => item.id === selectedId) || requests[0] || null;
  const activeRequestText = selectedRequest?.request || submittedRequest;
  const stages = useMemo(() => getPlan(activeRequestText), [activeRequestText]);
  const runtimePlan = useMemo(
    () => selectedRequest?.runtime_plan || buildHarnessPlan(activeRequestText),
    [activeRequestText, selectedRequest?.runtime_plan]
  );
  const confidence = selectedRequest?.qa_confidence || (activeRequestText.toLowerCase().includes('deploy') ? 78 : 86);
  const activeWorkers = selectedRequest?.assigned_agents?.length
    ? selectedRequest.assigned_agents.map((agent) => [agent.name, agent.role])
    : workers;
  const approvalReady = planAcknowledged && !!selectedRequest && approvalState !== 'approved';

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/harness-engineering/requests');
      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
        if (data.length) {
          setSelectedId((current) => current ?? data[0].id);
          setSubmittedRequest(data[0].request);
          setApprovalState(data[0].approval_state);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to reset demo showcase');
        return;
      }
      await fetchRequests();
      clearDemoClientState();
      reloadFreshDemoPage();
      alert('Demo showcase reset');
    } catch {
      alert('Failed to reset demo showcase');
    }
  };

  const submitRequest = async () => {
    if (isDemoModeActive) {
      alert('The public demo is read-only. Reset the showcase to refresh it.');
      return;
    }
    if (!request.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/harness-engineering/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create Harness Engineering request');
        return;
      }
      setRequests((prev) => [data, ...prev]);
      setSelectedId(data.id);
      setSubmittedRequest(data.request);
      setApprovalState(data.approval_state);
    } catch {
      alert('Failed to create Harness Engineering request');
    } finally {
      setSubmitting(false);
    }
  };

  const updateApproval = async (action: 'approve' | 'hold') => {
    if (isDemoModeActive) {
      alert('The public demo is read-only. Approval is pre-seeded there.');
      return;
    }
    if (!selectedRequest) return;
    try {
      const res = await fetch(`/api/harness-engineering/requests/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          runtime_plan: runtimePlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update approval');
        return;
      }
      setRequests((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setApprovalState(data.approval_state);
      if (action === 'approve') {
        setPlanAcknowledged(false);
      }
    } catch {
      alert('Failed to update approval');
    }
  };

  const startExecution = async () => {
    if (isDemoModeActive) {
      alert('The public demo is read-only. Use reset to reload the showcase.');
      return;
    }
    if (!selectedRequest || selectedRequest.approval_state !== 'approved') {
      alert('Approve the plan before execution starts.');
      return;
    }

    try {
      const res = await fetch('/api/start-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: selectedRequest.request,
          harness_request_id: selectedRequest.id,
          runtime_plan: runtimePlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to start execution');
        return;
      }
      alert(`Execution queued for request #${data.harness_request_id}`);
    } catch {
      alert('Failed to start execution');
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="cyvora-glass-strong rounded-2xl p-5 md:p-7">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="cyvora-chip rounded-full px-3 py-1 text-xs text-cyan-100">Cyvora · Harness</span>
                </div>
                <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
                  Harness Engineering
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-white md:text-5xl">
                  Harness Engineering Department
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  The internal software factory that plans, builds, validates, and improves the
                  Command Center through a safe harness with autonomous loops under human approval.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                  {runtimeInfo.label} · {runtimeInfo.description}
                </div>
                {isDemoModeActive ? (
                  <button
                    onClick={handleResetDemo}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                  >
                    Reset demo
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <label htmlFor="feature-request" className="text-sm font-medium text-slate-200">
                Feature request
              </label>
              <textarea
                id="feature-request"
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={4}
                className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Critical actions pause at approval gates before files are applied or deployed.
                </p>
                <button
                  onClick={submitRequest}
                  disabled={submitting || !request.trim() || isDemoModeActive}
                  className="rounded-xl bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDemoModeActive ? 'Demo is read-only' : submitting ? 'Saving request...' : 'Generate build plan'}
                </button>
              </div>
            </div>
          </div>

          <aside className="cyvora-glass rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Harness Board</h2>
                <p className="mt-1 text-sm text-slate-400">Safety, validation, and review</p>
              </div>
              <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-200">
                {confidence}% confidence
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <ReviewMetric label="Architecture fit" value="Strong" tone="emerald" />
              <ReviewMetric label="Sandbox state" value="Isolated" tone="emerald" />
              <ReviewMetric label="Validation state" value="Pending checks" tone="amber" />
              <ReviewMetric label="Deployment status" value="Approval locked" tone="rose" />
            </div>

            {isDemoModeActive ? (
              <div className="cyvora-tactile mt-5 rounded-xl p-4 text-sm text-slate-300 md:hidden">
                Read-only demo mode is active. The seeded request and approval flow are visible, and
                reset restores the showcase.
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-sm font-medium text-amber-100">Preserved safety note</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/80">
                {selectedRequest?.dissent ||
                  'Require sandbox execution, visible diffs, and deterministic checks before allowing autonomous edits to become permanent.'}
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="cyvora-glass rounded-2xl p-5 md:p-6">
            <h2 className="text-lg font-semibold">Assigned workforce</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {activeWorkers.map(([name, role]) => (
                <div key={name} className="cyvora-tactile rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-300/10 text-sm font-semibold text-cyan-200">
                      {name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="cyvora-glass rounded-2xl p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Build lifecycle</h2>
                <p className="mt-1 text-sm text-slate-400">Harness-first controlled delivery</p>
              </div>
              <div className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-300">
                {approvalState === 'pending' ? 'Waiting for founder' : approvalState}
              </div>
            </div>

            <div className="space-y-3">
              {stages.map((stage, index) => (
                <LifecycleRow key={stage.name} index={index + 1} stage={stage} />
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => updateApproval('approve')}
                disabled={!approvalReady || isDemoModeActive}
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve plan
              </button>
              <button
                onClick={() => updateApproval('hold')}
                disabled={!selectedRequest || isDemoModeActive}
                className="cyvora-chip rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hold for changes
              </button>
              <button
                onClick={startExecution}
                disabled={selectedRequest?.approval_state !== 'approved' || isDemoModeActive}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDemoModeActive ? 'Demo is read-only' : 'Start approved execution'}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 cyvora-glass-strong rounded-2xl p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Runtime plan</h2>
              <p className="mt-1 text-sm text-slate-400">
                Structured harness spec generated from the current request
              </p>
            </div>
              <div className="cyvora-chip rounded-full px-3 py-1 text-xs text-cyan-100">
              {runtimePlan.token_cost_ceiling.tokens} tokens · {runtimePlan.token_cost_ceiling.cost_usd}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RuntimePanel title="Sandbox scope" items={runtimePlan.sandbox_scope} />
            <RuntimePanel title="Permissions" items={runtimePlan.permissions} />
            <RuntimePanel title="Validation checks" items={runtimePlan.validation_checks} />
            <RuntimePanel title="Rollback path" items={runtimePlan.rollback_path} />
          </div>

            <div className="cyvora-tactile mt-4 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white">Runtime notes</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {runtimePlan.runtime_notes.map((note) => (
                  <div key={note} className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-300">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="cyvora-tactile mt-4 rounded-xl p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={planAcknowledged}
                  onChange={(event) => setPlanAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300 focus:ring-cyan-300"
                />
                <span>
                  <span className="block text-sm font-medium text-cyan-50">I have inspected this runtime plan</span>
                  <span className="mt-1 block text-xs leading-5 text-cyan-50/80">
                    Approval will only proceed when the plan snapshot matches the server-generated harness plan.
                  </span>
                </span>
              </label>
            </div>
          </section>

        <section className="mt-6 cyvora-glass-strong rounded-2xl p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Harness architecture</h2>
              <p className="mt-1 text-sm text-slate-400">
                The runtime guardrails that keep autonomous execution safe and measurable
              </p>
            </div>
              <div className="cyvora-chip rounded-full px-3 py-1 text-xs text-cyan-100">
              Loop Engineering inside Harness Engineering
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReviewMetric label="Sandboxing" value="Enabled" tone="emerald" />
            <ReviewMetric label="Permissions" value="Scoped" tone="emerald" />
            <ReviewMetric label="Validation" value="Deterministic" tone="amber" />
            <ReviewMetric label="Rollback" value="Ready" tone="rose" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="cyvora-tactile rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white">How to run the loop safely</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                <li>1. Define the goal and the acceptance checks before execution starts.</li>
                <li>2. Give the model only the tools it needs for that task.</li>
                <li>3. Run the loop in a sandbox with visible diffs and logs.</li>
                <li>4. Stop on validation failure instead of trying to “power through.”</li>
                <li>5. Keep human approval for risky state changes and deployments.</li>
              </ul>
            </div>

            <div className="cyvora-tactile rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white">What this changes next</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                The next useful product move is to make every self-coding request produce an
                explicit harness plan: sandbox, checks, permissions, rollback, and cost ceiling.
                That gives the agent a safe runtime instead of only a task description.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 cyvora-glass-strong rounded-2xl p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Build history</h2>
              <p className="mt-1 text-sm text-slate-400">Persistent Harness Engineering requests for this tenant</p>
            </div>
            <div className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-300">
              {requests.length} request{requests.length === 1 ? '' : 's'}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading requests...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-slate-400">No Harness Engineering requests yet. Create the first one above.</p>
          ) : (
            <div className="grid gap-3">
              {requests.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setSubmittedRequest(item.request);
                    setApprovalState(item.approval_state);
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    selectedRequest?.id === item.id
                      ? 'border-cyan-300/50 bg-cyan-300/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{item.request}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        Stage {item.stage} · {item.status.replaceAll('_', ' ')} · Updated{' '}
                        {new Date(item.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-300">
                      {item.qa_confidence}% QA
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function RuntimePanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="cyvora-tactile rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'amber' | 'rose';
}) {
  const tones = {
    emerald: 'text-emerald-200 bg-emerald-400/10 border-emerald-400/25',
    amber: 'text-amber-200 bg-amber-400/10 border-amber-400/25',
    rose: 'text-rose-200 bg-rose-400/10 border-rose-400/25',
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>
        {value}
      </span>
    </div>
  );
}

function LifecycleRow({ index, stage }: { index: number; stage: BuildStage }) {
  const statusStyle = {
    complete: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    active: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
    waiting: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
    locked: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  };

  return (
    <div className="cyvora-tactile grid gap-3 rounded-xl p-4 md:grid-cols-[72px_1fr_auto] md:items-center">
      <div className="text-sm font-semibold text-slate-500">0{index}</div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{stage.name}</h3>
          <span className="text-xs text-slate-500">by {stage.owner}</span>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-400">{stage.detail}</p>
      </div>
      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${statusStyle[stage.status]}`}>
        {stage.status}
      </span>
    </div>
  );
}
