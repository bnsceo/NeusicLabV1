import Image from 'next/image';
import { Suspense } from 'react';
import UnlockForm from './UnlockForm';

export default function UnlockPage() {
  return (
    <Suspense fallback={<UnlockShell nextPath="/" />}>
      <UnlockForm />
    </Suspense>
  );
}

function UnlockShell({ nextPath }: { nextPath: string }) {
  return (
    <div className="min-h-screen bg-[#070b12] px-4 py-10 text-white">
      <div className="cyvora-glass-strong mx-auto max-w-md rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <Image src="/cyvora-header-logo.png" alt="Cyvora" width={176} height={40} className="h-10 w-auto" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Private tunnel</p>
            <h1 className="text-2xl font-semibold">Unlock Cyvora</h1>
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
            className="mt-5 w-full px-4 py-3 text-sm"
          />

          <input type="hidden" name="next" value={nextPath} />

          <button
            type="submit"
            className="cyvora-chip mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:translate-y-[-1px]"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
