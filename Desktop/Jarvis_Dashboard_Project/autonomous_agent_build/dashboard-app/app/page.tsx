'use client';

import { useEffect, useState } from 'react';

interface Briefing {
  objective: string;
  agents: { name: string; task: string; output: string }[];
  status: 'pending' | 'approved' | 'abandoned';
  timestamp: string;
}

export default function Home() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const fetchBriefing = async () => {
    try {
      const res = await fetch('/api/briefing');
      const data = await res.json();
      setBriefing(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
    // SSE connection
    const es = new EventSource('/api/stream');
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setLogs(prev => [...prev, data.message]);
      } else if (data.type === 'start') {
        setLogs([]);
        setIsStreaming(true);
      } else if (data.type === 'done') {
        setIsStreaming(false);
        setBriefing(data.briefing);
      } else if (data.type === 'error') {
        setLogs(prev => [...prev, '❌ ' + data.message]);
      }
    };
    es.onerror = () => {
      console.error('SSE error');
      es.close();
      setIsStreaming(false);
    };
    return () => es.close();
  }, []);

  const handleNewMission = async () => {
    if (!goal.trim()) return;
    setSubmitting(true);
    setLogs([]);
    try {
      const res = await fetch('/api/start-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Error: ' + data.error);
      } else {
        setModalOpen(false);
        setGoal('');
      }
    } catch (e) {
      alert('Failed to start mission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWarRoom = async () => {
    try {
      const res = await fetch('/api/warroom');
      const data = await res.json();
      alert('Incidents:\n' + data.map((i: any) => `${i.title} (${i.severity})`).join('\n'));
    } catch (e) {
      alert('Failed to load War Room');
    }
  };

  const handleAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      alert(`Analytics:\nTotal Calls: ${data.totalCalls}\nTop Agents: ${data.topAgents.map((a: any) => `${a.name}: ${a.calls}`).join(', ')}`);
    } catch (e) {
      alert('Failed to load analytics');
    }
  };

  const handleApprove = async (action: 'decree' | 'abandon') => {
    if (!briefing) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, objective: briefing.objective }),
      });
      const data = await res.json();
      if (res.ok) {
        setBriefing(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Failed to approve mission');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-black text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              🏛️ Command Center
            </h1>
            <p className="text-slate-400 mt-1">Digital Empire · Autonomous Operations</p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="glass px-5 py-2 text-sm flex items-center gap-2">
              <span className="status-dot status-online"></span> System Online
            </div>
            <div className="glass px-5 py-2 text-sm text-slate-300">
              🧠 <span className="text-white font-semibold">Supervisor</span> active
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Agents" value="230+" color="indigo" />
          <StatCard label="Divisions" value="4" color="emerald" />
          <StatCard label="Active Missions" value={briefing ? '1' : '0'} color="amber" />
          <StatCard label="Incidents" value="0" color="rose" />
        </div>

        {/* World Map */}
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          🌍 World Map <span className="text-sm font-normal text-slate-400">· Revenue nodes</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <NodeCard name="Etsy" revenue="$12.4k" change="+8.2%" status="online" emoji="🧶" progress={75} />
          <NodeCard name="Fiverr" revenue="$8.7k" change="+3.1%" status="online" emoji="🎯" progress={50} />
          <NodeCard name="AI Analytics" revenue="$0" change="🚀 Launching" status="warning" emoji="🤖" progress={25} />
          <NodeCard name="Add Node" revenue="" change="" status="offline" emoji="➕" progress={0} isPlaceholder />
        </div>

        {/* Live Logs */}
        <div className="glass glass-dark p-6 mb-8">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            📡 Live Logs {isStreaming && <span className="animate-pulse text-emerald-400">●</span>}
          </h3>
          <div className="bg-black/40 rounded-xl p-4 max-h-64 overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
            {logs.length === 0 && <span className="text-slate-500">Waiting for mission...</span>}
            {logs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
        </div>

        {/* Mission Briefing */}
        <div className="glass glass-dark p-6 mb-8">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                📋 Latest Mission Briefing
                {briefing && (
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full">
                    {briefing.status.toUpperCase()}
                  </span>
                )}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {loading ? 'Loading...' : briefing ? briefing.objective : 'No active mission'}
              </p>
            </div>
            <div className="flex gap-2">
              {briefing && (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs flex items-center gap-1">
                  ✅ {briefing.agents.length} agents deployed
                </span>
              )}
            </div>
          </div>
          {briefing && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {briefing.agents.map((agent, idx) => (
                <div key={idx} className="bg-slate-800/40 rounded-lg px-4 py-2 text-sm text-slate-300">
                  <span className="text-indigo-300">{agent.name}</span> · {agent.task}
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap justify-between items-center gap-4">
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove('decree')}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!briefing || briefing.status === 'approved' || submitting}
              >
                ✅ DECREE
              </button>
              <button
                onClick={() => handleApprove('abandon')}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!briefing || briefing.status === 'abandoned' || submitting}
              >
                ❌ ABANDON
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>Status: <span className="font-semibold text-white">{briefing ? briefing.status : '—'}</span></span>
              <a href="/api/briefing" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">
                📄 Raw
              </a>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onClick={() => setModalOpen(true)} className="glass p-5 hover:border-indigo-500/40 transition cursor-pointer text-center">
            <span className="text-2xl">⚡</span>
            <p className="font-medium mt-2">New Mission</p>
            <p className="text-xs text-slate-400">Trigger Supervisor</p>
          </div>
          <div onClick={handleWarRoom} className="glass p-5 hover:border-indigo-500/40 transition cursor-pointer text-center">
            <span className="text-2xl">🛡️</span>
            <p className="font-medium mt-2">War Room</p>
            <p className="text-xs text-slate-400">View incidents</p>
          </div>
          <div onClick={handleAnalytics} className="glass p-5 hover:border-indigo-500/40 transition cursor-pointer text-center">
            <span className="text-2xl">📊</span>
            <p className="font-medium mt-2">Analytics</p>
            <p className="text-xs text-slate-400">Agent performance</p>
          </div>
        </div>

        <div className="mt-12 text-center text-slate-500 text-xs border-t border-white/5 pt-6">
          ⚡ Digital Empire · Autonomous Agent Build · v0.1
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass glass-dark max-w-lg w-full p-6 rounded-2xl">
            <h2 className="text-2xl font-bold mb-4">⚡ New Mission</h2>
            <p className="text-sm text-slate-400 mb-3">Enter the goal for the Supervisor:</p>
            <textarea
              className="w-full p-3 rounded-xl bg-slate-800/60 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="e.g. Build a new landing page for our AI tool"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setModalOpen(false); setGoal(''); }}
                className="px-5 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleNewMission}
                disabled={submitting || !goal.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '🚀 Deploying...' : 'DECREE Mission'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .glass-dark {
          background: rgba(10, 10, 20, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 8px;
        }
        .status-online { background: #4ade80; box-shadow: 0 0 12px #4ade80; }
        .status-warning { background: #facc15; box-shadow: 0 0 12px #facc15; }
        .status-offline { background: #f87171; box-shadow: 0 0 12px #f87171; }
      `}</style>
    </div>
  );
}

// ---- helper components ----
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  };
  return (
    <div className="glass p-5 text-center">
      <div className={`text-3xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

function NodeCard({ name, revenue, change, status, emoji, progress, isPlaceholder = false }: any) {
  const statusDot = `status-${status}`;
  return (
    <div className={`glass glass-dark node p-6 ${isPlaceholder ? 'border-dashed border-slate-600' : ''}`}>
      <div className="flex justify-between items-start">
        <span className="text-3xl">{emoji}</span>
        <span className={`status-dot ${statusDot}`}></span>
      </div>
      <h3 className={`text-xl font-bold mt-3 ${isPlaceholder ? 'text-slate-500' : ''}`}>{name}</h3>
      {!isPlaceholder && (
        <>
          <p className="text-sm text-slate-400">Revenue · {revenue}</p>
          <div className={`mt-3 text-xs ${change?.includes('+') ? 'text-emerald-300' : 'text-slate-500'}`}>
            {change}
          </div>
          <div className="mt-2 w-full bg-slate-700/50 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-400' : status === 'warning' ? 'bg-amber-400' : 'bg-slate-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}
      {isPlaceholder && (
        <div className="mt-3 text-xs text-slate-500">🔌 Click to configure</div>
      )}
    </div>
  );
}
