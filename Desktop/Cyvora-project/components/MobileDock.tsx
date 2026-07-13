'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const catalog: Record<string, { href: string; label: string; glyph: string }> = {
  home: { href: '/', label: 'Home', glyph: '⌂' },
  command: { href: '/command-center', label: 'Command', glyph: '▤' },
  executive: { href: '/executive-ai', label: 'Executive', glyph: '✦' },
  briefing: { href: '/briefing', label: 'Brief', glyph: '▧' },
  companies: { href: '/companies', label: 'Companies', glyph: '◫' },
  agents: { href: '/agents', label: 'Agents', glyph: '●' },
  headquarters: { href: '/headquarters', label: 'HQ', glyph: '⌘' },
  connectors: { href: '/connectors', label: 'Connectors', glyph: '⇄' },
  policies: { href: '/policies', label: 'Policies', glyph: '◇' },
  harness: { href: '/harness-engineering', label: 'Harness', glyph: '⚙' },
  warroom: { href: '/war-room', label: 'War Room', glyph: '⚠' },
  history: { href: '/history', label: 'History', glyph: '↻' },
};

const defaults = ['home', 'command', 'executive', 'companies', 'warroom'];

export default function MobileDock() {
  const pathname = usePathname();
  const [ids, setIds] = useState(defaults);
  useEffect(() => { const read = () => { try { const value = JSON.parse(window.localStorage.getItem('cyvora.dock') || JSON.stringify(defaults)); if (Array.isArray(value) && value.length >= 3) setIds(value.filter((id) => catalog[id]).slice(0, 5)); } catch { setIds(defaults); } }; read(); window.addEventListener('cyvora:dock-updated', read); return () => window.removeEventListener('cyvora:dock-updated', read); }, []);
  if (pathname.startsWith('/unlock')) return null;
  return <nav className="cyvora-mobile-dock lg:hidden" aria-label="Mobile navigation" style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))` }}>{ids.map((id) => { const item = catalog[id]; const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={id} href={item.href} className={`cyvora-mobile-dock-item ${active ? 'is-active' : ''} ${id === 'executive' ? 'is-primary' : ''}`}><span className="text-base leading-none">{item.glyph}</span><span className="mt-1 block truncate text-[9px]">{item.label}</span></Link>; })}</nav>;
}
