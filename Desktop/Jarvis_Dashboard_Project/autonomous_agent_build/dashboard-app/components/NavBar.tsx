'use client';

import Link from 'next/link';
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
