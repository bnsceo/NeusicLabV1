'use client';

import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useState } from 'react';

export default function UnlockPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unlock failed');
        return;
      }
      window.location.href = nextPath;
    } catch {
      setError('Unlock failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] px-4 py-10 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-blue-950/30">
        <div className="flex items-center gap-3">
          <Image src="/dominion-logo.svg" alt="Dominion" width={48} height={48} className="h-12 w-12 rounded-2xl" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Private tunnel</p>
            <h1 className="text-2xl font-semibold">Unlock AI Command Center</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-400">
          Enter the private access code to open the tunnel. This keeps the public link from being
          readable without permission.
        </p>

        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          type="password"
          placeholder="Access code"
          className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
        />

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        <button
          onClick={handleUnlock}
          disabled={loading || !code.trim()}
          className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Unlocking...' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}
