'use client';

import { useCallback, useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

interface Mission {
  id: number;
  objective: string;
  agents: any[];
  status: string;
  timestamp: string;
  briefing_file?: string;
}

export default function HistoryPage() {
  const runtimeInfo = getRuntimeModeInfo();
  const isDemoModeActive = runtimeInfo.mode === 'demo';
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/history?${params.toString()}`);
      const data = await res.json();
      setMissions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to reset demo showcase');
        return;
      }
      await fetchHistory();
      alert('Demo showcase reset');
    } catch {
      alert('Failed to reset demo showcase');
    }
  };

  const reloadMission = async (mission: Mission) => {
    try {
      const res = await fetch(`/api/history/${mission.id}`);
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('loadMission', JSON.stringify(data));
        window.location.href = '/';
      }
    } catch {
      alert('Failed to load mission');
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <NavBar />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-5 shadow-2xl shadow-blue-950/20 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">Mission Archive</p>
              <p className="mt-1 text-sm text-slate-400">
                {isDemoModeActive ? 'Read-only demo archive' : runtimeInfo.description}
              </p>
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
          <div className="mt-2 grid gap-5 lg:grid-cols-[1fr_280px] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold md:text-5xl">History</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Search previous mission briefings, reload decisions into Mission Control, and audit
                the AI organization over time.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-2xl font-semibold">{missions.length}</p>
              <p className="mt-1 text-xs text-slate-400">Visible missions</p>
            </div>
          </div>
          {isDemoModeActive ? (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300 md:hidden">
              The public demo archive is seeded, read-only, and resettable from this screen.
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              type="text"
              placeholder="Search objectives"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900/80 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900/80 p-3 text-sm text-white outline-none focus:border-cyan-300/60"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading history...</p>
            ) : missions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-slate-400">
                No missions found.
              </p>
            ) : (
              missions.map((mission) => (
                <div
                  key={mission.id}
                  onClick={() => setSelectedMission(mission)}
                  className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/40 hover:bg-white/[0.06]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={mission.status} />
                        <span className="text-xs text-slate-500">{new Date(mission.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 truncate text-sm font-medium">{mission.objective}</p>
                      <p className="mt-1 text-xs text-slate-400">{mission.agents?.length || 0} assigned agents</p>
                    </div>
                    <button
                      onClick={(event) => { event.stopPropagation(); reloadMission(mission); }}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/5"
                    >
                      Load
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {selectedMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-blue-950/40">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Mission details</h2>
                <p className="mt-1 text-sm text-slate-400">{selectedMission.objective}</p>
              </div>
              <button onClick={() => setSelectedMission(null)} className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/5">
                Close
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Detail label="Status" value={selectedMission.status} />
              <Detail label="Agents" value={(selectedMission.agents?.length || 0).toString()} />
              <Detail label="Timestamp" value={new Date(selectedMission.timestamp).toLocaleString()} />
            </div>
            <div className="mt-5 space-y-2">
              {selectedMission.agents?.map((agent: any, index: number) => (
                <div key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{agent.task}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => reloadMission(selectedMission)}
              className="mt-5 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Load into Mission Control
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'approved'
      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
      : status === 'abandoned'
        ? 'border-rose-300/20 bg-rose-300/10 text-rose-200'
        : 'border-amber-300/20 bg-amber-300/10 text-amber-200';
  return <span className={`rounded-full border px-3 py-1 text-xs ${style}`}>{status}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
