'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Panel = 'commands' | 'notifications' | 'activity' | 'settings' | 'shortcuts' | 'workspace' | null;
type Theme = 'midnight' | 'deep' | 'contrast';
type Density = 'comfortable' | 'compact';

type CommandItem = {
  id: string;
  label: string;
  description: string;
  href?: string;
  action?: () => void;
  keywords: string;
  shortcut?: string;
};

const notifications = [
  { title: 'Founder approval requested', detail: 'Content Studio launch plan is ready for review.', tone: 'amber' },
  { title: 'Worker health nominal', detail: 'No stale claims or critical incidents detected.', tone: 'emerald' },
  { title: 'Mock runtime active', detail: 'Paid providers and live connectors remain disabled.', tone: 'cyan' },
];

const fallbackActivity = [
  { title: 'Executive AI prepared a business blueprint', detail: 'Deterministic template · $0 provider cost' },
  { title: 'Worker heartbeat received', detail: 'Runtime recovery systems nominal' },
  { title: 'Approval policy evaluated', detail: 'Founder control preserved' },
];

function readSetting<T extends string>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  return (window.localStorage.getItem(key) as T | null) || fallback;
}

export default function OperatingSystemControls() {
  const pathname = usePathname();
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<Theme>('midnight');
  const [density, setDensity] = useState<Density>('comfortable');
  const [workspace, setWorkspace] = useState('default');
  const [savedLayouts, setSavedLayouts] = useState<string[]>([]);
  const [dock, setDock] = useState<string[]>(['home', 'command', 'executive', 'companies', 'warroom']);
  const [activity, setActivity] = useState(fallbackActivity);

  useEffect(() => {
    const storedTheme = readSetting<Theme>('cyvora.theme', 'midnight');
    const storedDensity = readSetting<Density>('cyvora.density', 'comfortable');
    const storedWorkspace = readSetting('cyvora.workspace', 'default');
    setTheme(storedTheme);
    setDensity(storedDensity);
    setWorkspace(storedWorkspace);
    document.documentElement.dataset.theme = storedTheme;
    document.documentElement.dataset.density = storedDensity;
    try {
      setSavedLayouts(JSON.parse(window.localStorage.getItem('cyvora.layouts') || '[]'));
      setDock(JSON.parse(window.localStorage.getItem('cyvora.dock') || '["home","command","executive","companies","warroom"]'));
    } catch {
      setSavedLayouts([]);
    }
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPanel('commands');
      } else if (!typing && event.key === '/') {
        event.preventDefault();
        setPanel('commands');
      } else if (!typing && event.key === '?') {
        event.preventDefault();
        setPanel('shortcuts');
      } else if (event.key === 'Escape') {
        setPanel(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const openCommands = () => setPanel('commands');
    const openNotifications = () => setPanel('notifications');
    const openSettings = () => setPanel('settings');
    const openWorkspace = () => setPanel('workspace');
    window.addEventListener('cyvora:commands', openCommands);
    window.addEventListener('cyvora:notifications', openNotifications);
    window.addEventListener('cyvora:settings', openSettings);
    window.addEventListener('cyvora:workspace', openWorkspace);
    return () => {
      window.removeEventListener('cyvora:commands', openCommands);
      window.removeEventListener('cyvora:notifications', openNotifications);
      window.removeEventListener('cyvora:settings', openSettings);
      window.removeEventListener('cyvora:workspace', openWorkspace);
    };
  }, []);

  useEffect(() => {
    if (!panel) return;
    fetch('/api/history')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const rows = Array.isArray(data) ? data : data?.events || data?.history || [];
        if (!Array.isArray(rows) || rows.length === 0) return;
        setActivity(rows.slice(0, 8).map((row: any) => ({
          title: row.title || row.event_type || 'Cyvora activity',
          detail: row.description || row.status || row.created_at || 'Recent activity',
        })));
      })
      .catch(() => undefined);
  }, [panel]);

  const commands = useMemo<CommandItem[]>(() => [
    { id: 'home', label: 'Open Home', description: 'Compact founder launchpad', href: '/', keywords: 'home launchpad overview' },
    { id: 'command', label: 'Open Command Center', description: 'Mission intake, approvals, and quick actions', href: '/command-center', keywords: 'mission approvals founder dashboard' },
    { id: 'executive', label: 'Ask Executive AI', description: 'Generate a deterministic business blueprint', href: '/executive-ai', keywords: 'executive ai blueprint company create', shortcut: 'E' },
    { id: 'briefing', label: 'Open Executive Briefing', description: 'Objectives, risks, opportunities, and recommendations', href: '/briefing', keywords: 'briefing summary risk opportunity recommendation' },
    { id: 'companies', label: 'Open Companies', description: 'Active businesses and company templates', href: '/companies', keywords: 'companies templates businesses portfolio' },
    { id: 'agents', label: 'Open Agent Registry', description: 'Search digital employees and capabilities', href: '/agents', keywords: 'agents registry workforce persona skills' },
    { id: 'hq', label: 'Open Headquarters', description: 'Organization graph and live operations', href: '/headquarters', keywords: 'headquarters agents teams departments operations' },
    { id: 'connectors', label: 'Open Connectors', description: 'Mock external capabilities and action simulator', href: '/connectors', keywords: 'connectors integrations github gmail youtube stripe mock' },
    { id: 'policies', label: 'Open Policies', description: 'Risk, cost, privacy, and approval governance', href: '/policies', keywords: 'policy governance risk approval cost privacy' },
    { id: 'approvals', label: 'Review Approvals', description: 'Founder decisions inside Command Center', href: '/command-center', keywords: 'approve review risk' },
    { id: 'harness', label: 'Open Harness', description: 'Software and runtime requests', href: '/harness-engineering', keywords: 'harness engineering code' },
    { id: 'warroom', label: 'Open War Room', description: 'Health, incidents, and recovery', href: '/war-room', keywords: 'war room incidents health security' },
    { id: 'history', label: 'Open History', description: 'Audit and execution timeline', href: '/history', keywords: 'history audit runs' },
    { id: 'activity', label: 'Show Recent Activity', description: 'Latest mission and runtime events', action: () => setPanel('activity'), keywords: 'recent activity timeline' },
    { id: 'workspace', label: 'Switch Workspace', description: `Current workspace: ${workspace}`, action: () => setPanel('workspace'), keywords: 'workspace tenant switch' },
    { id: 'settings', label: 'Customize Cyvora', description: 'Theme, density, layouts, and dock', action: () => setPanel('settings'), keywords: 'theme layout settings dock customize' },
  ], [workspace]);

  const filtered = commands.filter((item) => `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(query.toLowerCase()));

  function chooseTheme(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem('cyvora.theme', next);
  }

  function chooseDensity(next: Density) {
    setDensity(next);
    document.documentElement.dataset.density = next;
    window.localStorage.setItem('cyvora.density', next);
  }

  function chooseWorkspace(next: string) {
    setWorkspace(next);
    window.localStorage.setItem('cyvora.workspace', next);
    setPanel(null);
    router.refresh();
  }


  function toggleDock(id: string) {
    const next = dock.includes(id) ? dock.filter((item) => item !== id) : [...dock, id].slice(-5);
    if (next.length < 3) return;
    setDock(next);
    window.localStorage.setItem('cyvora.dock', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('cyvora:dock-updated', { detail: next }));
  }

  function saveLayout() {
    const name = window.prompt('Name this layout', `Layout ${savedLayouts.length + 1}`)?.trim();
    if (!name) return;
    const next = Array.from(new Set([...savedLayouts, name]));
    setSavedLayouts(next);
    window.localStorage.setItem('cyvora.layouts', JSON.stringify(next));
  }

  if (!panel) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/70 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
      {panel === 'commands' ? (
        <section className="cyvora-os-modal mx-auto mt-[10vh] w-[min(720px,calc(100%-1.5rem))] overflow-hidden">
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
            <span className="text-cyan-200">⌕</span>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Cyvora or run a command…" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-slate-600" />
            <kbd className="cyvora-os-kbd">Esc</kbd>
          </div>
          <div className="max-h-[62vh] overflow-y-auto p-2">
            <p className="px-3 py-2 text-[9px] uppercase tracking-[0.22em] text-slate-600">Commands and navigation</p>
            {filtered.map((item) => item.href ? (
              <Link key={item.id} href={item.href} onClick={() => setPanel(null)} className="cyvora-os-command">
                <span><strong>{item.label}</strong><small>{item.description}</small></span>{item.shortcut ? <kbd className="cyvora-os-kbd">{item.shortcut}</kbd> : <span className="text-slate-700">↵</span>}
              </Link>
            ) : (
              <button key={item.id} onClick={item.action} className="cyvora-os-command w-full text-left">
                <span><strong>{item.label}</strong><small>{item.description}</small></span><span className="text-slate-700">↵</span>
              </button>
            ))}
            {filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No matching command.</p> : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3 text-[10px] text-slate-600">
            <span>⌘K command palette · / search · ? shortcuts</span><span>{pathname}</span>
          </div>
        </section>
      ) : (
        <aside className="cyvora-os-drawer ml-auto h-full w-[min(430px,94vw)] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[9px] uppercase tracking-[0.22em] text-cyan-200/75">Cyvora OS</p><h2 className="mt-2 text-xl font-semibold text-white">{panel === 'notifications' ? 'Notification Center' : panel === 'activity' ? 'Recent Activity' : panel === 'settings' ? 'Appearance & Layouts' : panel === 'workspace' ? 'Workspace Switcher' : 'Keyboard Shortcuts'}</h2></div>
            <button onClick={() => setPanel(null)} className="cyvora-shell-icon-button" aria-label="Close">×</button>
          </div>

          {panel === 'notifications' ? <div className="mt-6 space-y-3">{notifications.map((item) => <article key={item.title} className="cyvora-os-card"><div className={`cyvora-os-status is-${item.tone}`} /><div><strong>{item.title}</strong><p>{item.detail}</p></div></article>)}</div> : null}

          {panel === 'activity' ? <div className="mt-6 space-y-3">{activity.map((item, index) => <article key={`${item.title}-${index}`} className="cyvora-os-card"><div className="cyvora-os-status is-cyan" /><div><strong>{item.title}</strong><p>{item.detail}</p></div></article>)}</div> : null}

          {panel === 'workspace' ? <div className="mt-6 space-y-3">{['default', 'founder-lab', 'demo-showcase'].map((item) => <button key={item} onClick={() => chooseWorkspace(item)} className={`cyvora-os-card w-full text-left ${workspace === item ? 'ring-1 ring-cyan-300/30' : ''}`}><div className="cyvora-os-status is-violet" /><div><strong className="capitalize">{item.replaceAll('-', ' ')}</strong><p>{item === 'default' ? 'Primary founder workspace' : item === 'founder-lab' ? 'Private experiments and mock companies' : 'Seeded presentation workspace'}</p></div></button>)}</div> : null}

          {panel === 'shortcuts' ? <div className="mt-6 space-y-3">{[['⌘ / Ctrl + K', 'Open command palette'], ['/', 'Global search'], ['?', 'Show keyboard shortcuts'], ['Esc', 'Close any overlay'], ['E', 'Executive AI from command palette']].map(([keys, label]) => <div key={keys} className="cyvora-os-card"><kbd className="cyvora-os-kbd">{keys}</kbd><div><strong>{label}</strong><p>Available throughout the protected application.</p></div></div>)}</div> : null}

          {panel === 'settings' ? (
            <div className="mt-6 space-y-6">
              <section><p className="cyvora-os-section-label">Theme</p><div className="grid grid-cols-3 gap-2">{(['midnight', 'deep', 'contrast'] as Theme[]).map((item) => <button key={item} onClick={() => chooseTheme(item)} className={`cyvora-os-choice ${theme === item ? 'is-selected' : ''}`}><span className={`cyvora-theme-swatch is-${item}`} /><strong className="capitalize">{item}</strong></button>)}</div></section>
              <section><p className="cyvora-os-section-label">Density</p><div className="grid grid-cols-2 gap-2">{(['comfortable', 'compact'] as Density[]).map((item) => <button key={item} onClick={() => chooseDensity(item)} className={`cyvora-os-choice ${density === item ? 'is-selected' : ''}`}><strong className="capitalize">{item}</strong><small>{item === 'compact' ? 'More information on screen' : 'Larger spacing and touch targets'}</small></button>)}</div></section>
              <section><div className="flex items-center justify-between gap-3"><p className="cyvora-os-section-label mb-0">Saved layouts</p><button onClick={saveLayout} className="cyvora-chip px-3 py-2 text-[10px] text-cyan-100">Save current</button></div><div className="mt-3 space-y-2">{savedLayouts.length ? savedLayouts.map((item) => <div key={item} className="cyvora-os-card"><div className="cyvora-os-status is-emerald" /><div><strong>{item}</strong><p>{theme} theme · {density} density</p></div></div>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">No saved layouts yet.</p>}</div></section>
              <section><p className="cyvora-os-section-label">Mobile dock</p><p className="mb-3 text-xs leading-6 text-slate-500">Pin three to five destinations. This preference stays local to the browser.</p><div className="grid grid-cols-2 gap-2">{[['home','Home'],['command','Command'],['executive','Executive AI'],['briefing','Briefing'],['companies','Companies'],['agents','Agents'],['headquarters','Headquarters'],['connectors','Connectors'],['policies','Policies'],['harness','Harness'],['warroom','War Room'],['history','History']].map(([id,label]) => <button key={id} onClick={() => toggleDock(id)} className={`cyvora-os-choice min-h-12 ${dock.includes(id) ? 'is-selected' : ''}`}><strong>{label}</strong><small>{dock.includes(id) ? 'Pinned' : 'Not pinned'}</small></button>)}</div></section>
            </div>
          ) : null}
        </aside>
      )}
    </div>
  );
}
