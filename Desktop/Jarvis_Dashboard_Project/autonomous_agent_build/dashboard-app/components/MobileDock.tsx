'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Home' },
  { href: '/headquarters', label: 'HQ' },
  { href: '/companies', label: 'Companies' },
  { href: '/harness-engineering', label: 'Harness' },
  { href: '/history', label: 'History' },
];

export default function MobileDock() {
  const pathname = usePathname();

  return (
    <nav className="cyvora-tactile fixed inset-x-0 bottom-0 z-40 border-t-0 md:hidden">
      <div className="mx-auto grid max-w-7xl grid-cols-5 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`cyvora-chip rounded-xl px-2 py-2 text-center text-[11px] font-medium transition ${
                active
                  ? 'cyvora-neumo-pressed text-cyan-100'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="block truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
