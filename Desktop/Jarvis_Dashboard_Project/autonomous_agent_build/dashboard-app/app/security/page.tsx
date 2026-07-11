'use client';

import { useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';

interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  status: 'open' | 'in-progress' | 'resolved';
  date: string;
}

interface Compliance {
  standard: string;
  status: 'compliant' | 'non-compliant' | 'partial';
  details: string;
  lastAudit: string;
}

interface SecurityIncident {
  id: string;
  title: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
  remediation: string;
}

export default function SecurityDashboard() {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [compliance, setCompliance] = useState<Compliance[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      const res = await fetch('/api/security-dashboard');
      const data = await res.json();
      setVulnerabilities(data.vulnerabilities || []);
      setCompliance(data.compliance || []);
      setIncidents(data.incidents || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <NavBar />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <section className="cyvora-glass-strong rounded-2xl p-5 md:p-7">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">War Room</p>
          <div className="mt-2 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold md:text-5xl">Reliability and security</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                The autonomous quality-control room for incidents, vulnerabilities, compliance,
                and proposed repairs before founder approval.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Incidents" value={incidents.length} />
              <Stat label="Open vulns" value={vulnerabilities.length} />
              <Stat label="Audits" value={compliance.length} />
            </div>
          </div>
        </section>

        {loading ? (
          <p className="mt-6 cyvora-glass rounded-2xl p-6 text-sm text-slate-400">
            Loading War Room...
          </p>
        ) : (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel title="Compliance status" subtitle="Control surfaces and audit posture">
              {compliance.length === 0 ? (
                <Empty>No compliance data available.</Empty>
              ) : (
                <div className="grid gap-3">
                  {compliance.map((item) => (
                    <div key={item.standard} className="cyvora-tactile rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{item.standard}</p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{item.details}</p>
                      <p className="mt-2 text-xs text-slate-500">Last audit: {item.lastAudit}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent incidents" subtitle="Failures, anomalies, and repair candidates">
              {incidents.length === 0 ? (
                <Empty>No incidents recorded.</Empty>
              ) : (
                <div className="space-y-3">
                  {incidents.map((incident) => (
                    <div key={incident.id} className="cyvora-tactile rounded-xl p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Severity severity={incident.severity} />
                        <span className="text-xs text-slate-400">{incident.status}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{incident.title}</p>
                      <p className="mt-1 text-sm text-slate-400">Remediation: {incident.remediation || 'Pending'}</p>
                      <p className="mt-2 text-xs text-slate-500">{incident.timestamp}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Open vulnerabilities" subtitle="Security work waiting for remediation">
              {vulnerabilities.length === 0 ? (
                <Empty>No vulnerabilities reported.</Empty>
              ) : (
                <div className="space-y-3">
                  {vulnerabilities.map((vulnerability) => (
                    <div key={vulnerability.id} className="cyvora-tactile rounded-xl p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Severity severity={vulnerability.severity} />
                        <span className="text-xs text-slate-400">{vulnerability.status}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{vulnerability.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{vulnerability.description}</p>
                      <p className="mt-2 text-xs text-slate-500">Reported: {vulnerability.date}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </section>
        )}
      </main>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="cyvora-glass rounded-2xl p-5 md:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cyvora-tactile rounded-xl p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-slate-400">{children}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'compliant'
      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
      : status === 'non-compliant'
        ? 'border-rose-300/20 bg-rose-300/10 text-rose-200'
        : 'border-amber-300/20 bg-amber-300/10 text-amber-200';
  return <span className={`rounded-full border px-3 py-1 text-xs ${style}`}>{status}</span>;
}

function Severity({ severity }: { severity: string }) {
  const style =
    severity === 'critical'
      ? 'border-rose-300/20 bg-rose-300/10 text-rose-200'
      : severity === 'high'
        ? 'border-orange-300/20 bg-orange-300/10 text-orange-200'
        : severity === 'medium'
          ? 'border-amber-300/20 bg-amber-300/10 text-amber-200'
          : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200';
  return <span className={`rounded-full border px-3 py-1 text-xs ${style}`}>{severity}</span>;
}
