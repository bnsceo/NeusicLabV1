'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

export default function NavBar() {
  const pathname = usePathname();
  const runtime = getRuntimeModeInfo();

  const links = [
    { href: '/', label: 'Command Center' },
    { href: '/headquarters', label: 'Headquarters' },
    { href: '/companies', label: 'Companies' },
    { href: '/harness-engineering', label: 'Harness Engineering' },
    { href: '/security', label: 'War Room' },
    { href: '/history', label: 'History' },
  ];

  return (
    <nav className="bg-slate-950/75 backdrop-blur border-b border-white/10 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:bg-white/[0.06]">
            <Image src="/dominion-logo.svg" alt="Neusic Foundry logo" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">Neusic Foundry</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">Autonomous business OS</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  pathname === link.href
                    ? 'bg-white/10 text-white shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex max-w-full items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]" />
          {runtime.label}
          <span className="hidden text-emerald-100/70 sm:inline">·</span>
          <span className="hidden max-w-[18rem] truncate sm:inline">{runtime.description}</span>
        </div>
      </div>
    </nav>
  );
}
