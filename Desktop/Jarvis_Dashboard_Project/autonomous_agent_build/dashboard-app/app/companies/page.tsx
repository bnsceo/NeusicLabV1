'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import NavBar from '@/components/NavBar';
import CyvoraPageHeader from '@/components/CyvoraPageHeader';
import { inferMissionBlueprint } from '@/lib/missionBlueprint';
import { clearDemoClientState, reloadFreshDemoPage } from '@/lib/demoClient';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';

interface Company {
  id: number;
  name: string;
  description: string;
  brand_color: string;
  created_at: string;
  status: string;
}

const actionButtonBase =
  'inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm transition';
const actionButtonFilled = `${actionButtonBase} bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200`;
const actionButtonOutline = `${actionButtonBase} border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]`;

export default function CompaniesPage() {
  const runtimeInfo = getRuntimeModeInfo();
  const isDemoModeActive = runtimeInfo.mode === 'demo';
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [vision, setVision] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [blueprintApproved, setBlueprintApproved] = useState(false);

  const preview = useMemo(() => {
    const trimmed = vision.trim();
    if (!trimmed) return null;
    return inferMissionBlueprint(trimmed);
  }, [vision]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    setBlueprintApproved(false);
  }, [vision]);

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to reset demo showcase');
        return;
      }
      await fetchCompanies();
      clearDemoClientState();
      reloadFreshDemoPage();
      alert('Demo showcase reset');
    } catch {
      alert('Failed to reset demo showcase');
    }
  };

  const handleCreateCompany = async () => {
    if (isDemoModeActive) {
      alert('The public demo is read-only. Reset the showcase to refresh the data.');
      return;
    }
    if (!vision.trim()) return;
    if (!blueprintApproved) {
      alert('Approve the generated blueprint before building the company.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/execute-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vision }),
      });
      const data = await res.json();
      if (res.ok) {
        setVision('');
        setBlueprintApproved(false);
        await fetchCompanies();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <NavBar />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <CyvoraPageHeader
          eyebrow="Vision intake"
          title="Companies"
          description={runtimeInfo.description}
        >
          <Pill tone="emerald">Local-first</Pill>
          <Pill tone="cyan">Approval aware</Pill>
          <Pill tone="amber">Vision to org</Pill>
        </CyvoraPageHeader>

        <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-5 shadow-2xl shadow-blue-950/20 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
                Business Builder
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {isDemoModeActive ? 'Read-only demo showcase' : 'Capture founder visions and build companies'}
              </p>
            </div>
            {isDemoModeActive ? (
              <button
                onClick={handleResetDemo}
                className={actionButtonOutline}
              >
                Reset demo
              </button>
            ) : null}
          </div>
          <div className="mt-2 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold md:text-5xl">Companies</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Create founder-level business objectives. The Executive AI turns them into
                companies, departments, teams, and assigned agents.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="cyan">Intent capture</Pill>
                <Pill tone="emerald">Org synthesis</Pill>
                <Pill tone="blue">Execution routing</Pill>
              </div>
            </div>
            <div className="grid gap-3">
              <Stat label="Active" value={companies.length.toString()} />
              <Stat label="Status" value="Online" />
              <Stat label="Mode" value={runtimeInfo.label} />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Vision bridge</p>
              <h2 className="mt-2 text-2xl font-semibold">From a sentence to a company map</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                The best next step toward the original vision is to make the intake flow more explicit:
                capture the goal, preview the org structure, and then build the company.
              </p>
            </div>
            <Pill tone="emerald">Vision-first onboarding</Pill>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StepCard
              step="01"
              title="State the outcome"
              text="Describe the business result in plain language, not implementation details."
            />
            <StepCard
              step="02"
              title="Preview the org"
              text="The dashboard can show how the vision turns into departments, teams, and agents."
            />
            <StepCard
              step="03"
              title="Build with control"
              text="Approval stays visible, logs stay local, and paid APIs remain off."
            />
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <h2 className="text-lg font-semibold">Create company</h2>
            <p className="mt-1 text-sm text-slate-400">Describe the business you want the Executive AI to build.</p>
            <textarea
              className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
              rows={6}
              placeholder="Example: Start an Etsy print-on-demand store selling custom t-shirts."
              value={vision}
              onChange={(event) => setVision(event.target.value)}
            />
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Approval gate</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {preview
                      ? 'Review the exact org blueprint that will be created.'
                      : 'Enter an objective to generate a blueprint preview.'}
                  </p>
                </div>
                <label className={`flex items-center gap-2 text-sm ${preview ? 'text-slate-200' : 'cursor-not-allowed text-slate-500'}`}>
                  <input
                    type="checkbox"
                    checked={blueprintApproved}
                    disabled={!preview || isDemoModeActive}
                    onChange={(event) => setBlueprintApproved(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30 disabled:cursor-not-allowed"
                  />
                  Approve blueprint
                </label>
              </div>

              {preview ? (
                <div className="mt-4 grid gap-3">
                  <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Generated company</p>
                        <h3 className="mt-1 text-lg font-semibold text-white">{preview.companyName}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{preview.description}</p>
                      </div>
                      <span
                        className="h-10 w-10 rounded-xl ring-1 ring-white/10"
                        style={{ backgroundColor: preview.brandColor }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {preview.connectors.map((connector) => (
                        <span
                          key={connector}
                          className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100"
                        >
                          {connector}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Departments</p>
                      <div className="mt-3 space-y-3">
                        {preview.departments.map((department) => (
                          <div key={department.name} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <p className="text-sm font-semibold text-white">{department.name}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">{department.description}</p>
                            <p className="mt-2 text-xs text-cyan-100/80">
                              {department.teams.length} team{department.teams.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Execution shape</p>
                      <div className="mt-3 space-y-3">
                        {preview.departments.map((department) => (
                          <div key={department.name} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <p className="text-sm font-semibold text-white">{department.name}</p>
                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              {department.teams
                                .map((team) => `${team.name}: ${team.agents.map((agent) => agent.name).join(', ')}`)
                                .join(' · ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                  The preview will appear here as soon as you type a business objective.
                </p>
              )}
            </div>
            <button
              onClick={handleCreateCompany}
              disabled={submitting || !vision.trim() || !blueprintApproved || isDemoModeActive}
              className={`mt-4 w-full ${actionButtonFilled} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isDemoModeActive
                ? 'Demo is read-only'
                : submitting
                  ? 'Building company...'
                  : blueprintApproved
                    ? 'Build approved company'
                    : 'Approve blueprint to continue'}
            </button>
            <Link
              href="/headquarters"
              className={`mt-3 block ${actionButtonOutline} text-center`}
            >
              Open Headquarters
            </Link>
            {isDemoModeActive ? (
              <button
                type="button"
                onClick={handleResetDemo}
                className={`mt-3 block w-full ${actionButtonOutline} text-center md:hidden`}
              >
                Reset demo
              </button>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Business portfolio</h2>
                <p className="mt-1 text-sm text-slate-400">Operating companies created by the Executive AI</p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading companies...</p>
            ) : companies.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-slate-400">
                No companies yet. Create your first business objective to begin growing the organization.
              </p>
            ) : (
              <div className="grid gap-3">
                {companies.map((company) => (
                  <Link
                    href={`/companies/${company.id}`}
                    key={company.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/40 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="h-11 w-11 rounded-xl ring-1 ring-white/10"
                        style={{ backgroundColor: company.brand_color || '#38bdf8' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-white">{company.name}</h3>
                          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-200">
                            {company.status || 'active'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{company.description || 'No description'}</p>
                      </div>
                      <span className="text-xs text-slate-500">{new Date(company.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function Pill({ tone, children }: { tone: 'cyan' | 'emerald' | 'amber' | 'blue'; children: React.ReactNode }) {
  const styles = {
    cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    blue: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
  };

  return <span className={`rounded-full border px-3 py-1 text-xs ${styles[tone]}`}>{children}</span>;
}

function StepCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{step}</p>
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}
