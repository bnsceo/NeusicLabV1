'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import MobileDock from '@/components/MobileDock';
import OperatingSystemControls from '@/components/OperatingSystemControls';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

type IconName = 'home' | 'command' | 'executive' | 'briefing' | 'companies' | 'agents' | 'headquarters' | 'connectors' | 'policies' | 'harness' | 'warroom' | 'history' | 'menu' | 'bell' | 'search' | 'collapse';

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9 20v-6h6v6"/></>,
    command: <><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8h8M8 12h5M8 16h7"/></>,
    executive: <><path d="M12 3 9.8 8.4 4 10.2l4.6 3.7-.2 5.9 3.6-4.6 5.6 2-.9-5.8 3.7-4.6-5.8-.9L12 3Z"/><circle cx="12" cy="11" r="2"/></>,
    briefing: <><path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    companies: <><rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="3" width="8" height="16" rx="1.5"/><path d="M6 9h2M6 13h2M16 7h2M16 11h2M16 15h2"/></>,
    agents: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="7" r="2"/><path d="M3 20c0-4 2-7 5-7s5 3 5 7M14 20c0-3 1.4-5 3.5-5S21 17 21 20"/></>,
    headquarters: <><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v4M5 15.5v-2h14v2"/></>,
    connectors: <><path d="M8 12h8"/><path d="M6 9v6a3 3 0 0 0 3 3h1"/><path d="M18 9v6a3 3 0 0 1-3 3h-1"/><path d="M9 6V3M15 6V3"/><rect x="6" y="6" width="12" height="6" rx="2"/></>,
    policies: <><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></>,
    harness: <><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="4"/></>,
    warroom: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16.5v.1"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    collapse: <><path d="m14 6-6 6 6 6"/><path d="M20 4v16"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{paths[name]}</svg>;
}

const primaryLinks = [
  { href: '/', label: 'Home', icon: 'home' as IconName },
  { href: '/command-center', label: 'Command Center', icon: 'command' as IconName },
  { href: '/executive-ai', label: 'Executive AI', icon: 'executive' as IconName },
  { href: '/briefing', label: 'Executive Briefing', icon: 'briefing' as IconName },
  { href: '/companies', label: 'Companies', icon: 'companies' as IconName },
  { href: '/agents', label: 'Agents', icon: 'agents' as IconName },
  { href: '/headquarters', label: 'Headquarters', icon: 'headquarters' as IconName },
];

const governanceLinks = [
  { href: '/connectors', label: 'Connectors', icon: 'connectors' as IconName },
  { href: '/policies', label: 'Policies', icon: 'policies' as IconName },
];

const operationsLinks = [
  { href: '/harness-engineering', label: 'Harness', icon: 'harness' as IconName },
  { href: '/war-room', label: 'War Room', icon: 'warroom' as IconName },
  { href: '/history', label: 'History', icon: 'history' as IconName },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  const link = [...primaryLinks, ...governanceLinks, ...operationsLinks].find((item) => isActive(pathname, item.href));
  if (pathname.startsWith('/companies/')) return 'Company Detail';
  if (pathname.startsWith('/agents/')) return 'Agent Profile';
  return link?.label || 'Cyvora';
}


type SidebarContentProps = {
  pathname: string;
  runtime: ReturnType<typeof getRuntimeModeInfo>;
  health: 'online' | 'degraded';
  avgLatency: string;
};

function SidebarContent({ pathname, runtime, health, avgLatency }: SidebarContentProps) {
  return <>
    <div className="flex items-center gap-2">
      <Link href="/" className="cyvora-shell-brand min-w-0 flex-1" aria-label="Cyvora Home">
        <span className="cyvora-shell-mark"><Image src="/cyvora-mark.svg" alt="" width={34} height={34} className="h-8 w-8" /></span>
        <span className="cyvora-sidebar-copy min-w-0 leading-tight"><span className="block text-[15px] font-semibold tracking-[0.02em] text-white">Cyvora</span><span className="mt-1 block truncate text-[9px] uppercase tracking-[0.22em] text-cyan-200/75">AI Business OS</span></span>
      </Link>
    </div>
    <nav className="mt-6" aria-label="Primary navigation"><p className="cyvora-shell-nav-label cyvora-sidebar-copy">Workspace</p><div className="space-y-1.5">{primaryLinks.map((link) => <Link key={link.href} href={link.href} title={link.label} className={`cyvora-shell-nav-item ${isActive(pathname, link.href) ? 'is-active' : ''}`}><span className="cyvora-shell-nav-icon"><Icon name={link.icon} /></span><span className="cyvora-sidebar-copy truncate">{link.label}</span></Link>)}</div></nav>
    <nav className="mt-7" aria-label="Governance navigation"><p className="cyvora-shell-nav-label cyvora-sidebar-copy">Governance</p><div className="space-y-1.5">{governanceLinks.map((link) => <Link key={link.href} href={link.href} title={link.label} className={`cyvora-shell-nav-item ${isActive(pathname, link.href) ? 'is-active' : ''}`}><span className="cyvora-shell-nav-icon"><Icon name={link.icon} /></span><span className="cyvora-sidebar-copy truncate">{link.label}</span></Link>)}</div></nav>
    <nav className="mt-7" aria-label="Operations navigation"><p className="cyvora-shell-nav-label cyvora-sidebar-copy">Operations</p><div className="space-y-1.5">{operationsLinks.map((link) => <Link key={link.href} href={link.href} title={link.label} className={`cyvora-shell-nav-item ${isActive(pathname, link.href) ? 'is-active' : ''}`}><span className="cyvora-shell-nav-icon"><Icon name={link.icon} /></span><span className="cyvora-sidebar-copy truncate">{link.label}</span></Link>)}</div></nav>
    <div className="mt-auto pt-6"><div className="cyvora-shell-runtime"><div className="flex items-center justify-between gap-3"><span className="cyvora-sidebar-copy text-xs font-semibold text-white">{runtime.label}</span><span className={`h-2 w-2 rounded-full ${health === 'online' ? 'bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.85)]' : 'bg-amber-300'}`} /></div><div className="cyvora-sidebar-copy"><p className="mt-2 text-[10px] leading-5 text-slate-400">{runtime.description}</p><div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10px] text-slate-500"><span>{health === 'online' ? 'System nominal' : 'Check health'}</span><span>{avgLatency}</span></div></div></div></div>
  </>;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const runtime = getRuntimeModeInfo();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avgLatency, setAvgLatency] = useState('—');
  const [health, setHealth] = useState<'online' | 'degraded'>('online');
  const title = useMemo(() => pageTitle(pathname), [pathname]);
  const publicRoute = pathname.startsWith('/unlock');

  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    if (publicRoute) return;
    let alive = true;
    Promise.allSettled([
      fetch('/api/analytics').then((response) => response.json()),
      fetch('/api/health').then((response) => response.json()),
    ]).then(([analyticsResult, healthResult]) => {
      if (!alive) return;
      setAvgLatency(analyticsResult.status === 'fulfilled' && analyticsResult.value?.averageResponseTime ? analyticsResult.value.averageResponseTime : 'n/a');
      if (healthResult.status === 'fulfilled' && healthResult.value?.status && healthResult.value.status !== 'healthy') setHealth('degraded');
    });
    return () => { alive = false; };
  }, [publicRoute]);

  if (publicRoute) return <>{children}</>;

  return <div className="cyvora-app-shell">
    {drawerOpen ? <div className="fixed inset-0 z-[80] flex justify-start pointer-events-none" role="dialog" aria-label="Navigation"><aside className="cyvora-app-sidebar pointer-events-auto relative flex h-full w-[min(19rem,88vw)]"><SidebarContent pathname={pathname} runtime={runtime} health={health} avgLatency={avgLatency} /></aside></div> : null}

    <div className="cyvora-shell-main min-w-0">
      <header className="cyvora-app-topbar"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setDrawerOpen((current) => !current)} className="cyvora-shell-icon-button" aria-label="Toggle navigation" aria-expanded={drawerOpen}><Icon name="menu" /></button><div className="min-w-0"><div className="flex items-center gap-2 text-[10px] text-slate-600"><Link href="/">Cyvora</Link><span>/</span><span className="text-cyan-100/70">{title}</span></div><p className="mt-1 truncate text-sm font-semibold text-white">{title}</p></div></div>
        <div className="flex items-center gap-2"><button onClick={() => window.dispatchEvent(new Event('cyvora:commands'))} className="cyvora-shell-search hidden sm:flex" aria-label="Open command palette"><Icon name="search" /><span>Search</span><kbd>⌘K</kbd></button><button onClick={() => window.dispatchEvent(new Event('cyvora:notifications'))} className="cyvora-shell-icon-button relative" aria-label="Notifications"><Icon name="bell" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-400" /></button><button onClick={() => window.dispatchEvent(new Event('cyvora:workspace'))} className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] text-xs font-bold text-cyan-100">AP</button></div>
      </header>
      <div className="cyvora-app-content">{children}</div>
      <footer className="border-t border-white/[0.06] px-5 py-5 text-center text-[10px] text-slate-600"><div className="mx-auto flex items-center justify-center gap-2"><Image src="/cyvora-header-logo.png" alt="Cyvora" width={88} height={20} className="h-5 w-auto" /><span>Created by Anderson · Founder · Cyvora</span></div></footer>
    </div>
    <OperatingSystemControls />
    <MobileDock />
  </div>;
}
