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
    <nav className="cyvora-tactile sticky top-0 z-50 border-x-0 border-t-0 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="cyvora-tactile flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:translate-y-[-1px]">
            <Image src="/cyvora-header-logo.png" alt="Cyvora logo" width={926} height={854} className="h-12 w-auto shrink-0" priority />
          </Link>

          <div className="flex items-center gap-2 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`cyvora-chip whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  pathname === link.href
                    ? 'cyvora-neumo-pressed text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="cyvora-chip flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs text-cyan-100">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]" />
          {runtime.label}
          <span className="hidden text-emerald-100/70 sm:inline">·</span>
          <span className="hidden max-w-[18rem] truncate sm:inline">{runtime.description}</span>
        </div>
      </div>
    </nav>
  );
}
