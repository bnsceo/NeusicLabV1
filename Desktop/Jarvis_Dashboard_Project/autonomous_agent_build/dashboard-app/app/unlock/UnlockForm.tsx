'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

export default function UnlockForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';

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

        <form action="/api/unlock" method="post" className="mt-4">
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Enter the private access code to open the tunnel. This keeps the public link from
            being readable without permission.
          </p>

          <input
            name="code"
            type="password"
            placeholder="Access code"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="done"
            className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
          />

          <input type="hidden" name="next" value={nextPath} />

          <button
            type="submit"
            className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
