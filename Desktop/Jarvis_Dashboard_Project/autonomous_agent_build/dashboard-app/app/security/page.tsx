'use client';

import { useEffect, useState } from 'react';

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const map: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-black',
      low: 'bg-blue-400 text-white',
    };
    return map[severity] || 'bg-gray-500';
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'open': 'text-red-400',
      'in-progress': 'text-yellow-400',
      'resolved': 'text-green-400',
      'investigating': 'text-orange-400',
    };
    return map[status] || 'text-gray-400';
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 p-6 text-white flex items-center justify-center">
      <div className="text-xl">Loading security dashboard...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
          🛡️ Security Dashboard
        </h1>

        <div className="glass glass-dark p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Compliance Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {compliance.length === 0 && <p className="text-slate-400 col-span-3">No compliance data available.</p>}
            {compliance.map((item, idx) => (
              <div key={idx} className="bg-slate-800/40 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <span className="font-medium">{item.standard}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.status === 'compliant' ? 'bg-green-500/20 text-green-300' :
                    item.status === 'non-compliant' ? 'bg-red-500/20 text-red-300' :
                    'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{item.details}</p>
                <p className="text-xs text-slate-500 mt-2">Last audit: {item.lastAudit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass glass-dark p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Open Vulnerabilities</h2>
          {vulnerabilities.length === 0 && <p className="text-slate-400">No vulnerabilities reported.</p>}
          <div className="space-y-3">
            {vulnerabilities.map((v) => (
              <div key={v.id} className="bg-slate-800/40 rounded-lg p-4 flex flex-wrap justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(v.severity)}`}>
                      {v.severity.toUpperCase()}
                    </span>
                    <span className={`text-sm ${getStatusColor(v.status)}`}>{v.status}</span>
                  </div>
                  <h4 className="font-medium mt-1">{v.title}</h4>
                  <p className="text-sm text-slate-400">{v.description}</p>
                  <p className="text-xs text-slate-500 mt-1">Reported: {v.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass glass-dark p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Security Incidents</h2>
          {incidents.length === 0 && <p className="text-slate-400">No incidents recorded.</p>}
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div key={inc.id} className="bg-slate-800/40 rounded-lg p-4">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(inc.severity)}`}>
                        {inc.severity.toUpperCase()}
                      </span>
                      <span className={`text-sm ${getStatusColor(inc.status)}`}>{inc.status}</span>
                    </div>
                    <h4 className="font-medium mt-1">{inc.title}</h4>
                    <p className="text-sm text-slate-400">Remediation: {inc.remediation || 'Pending'}</p>
                    <p className="text-xs text-slate-500 mt-1">{inc.timestamp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-xs">
          🔐 Security data is tenant‑specific.
        </div>
      </div>

      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .glass-dark {
          background: rgba(10, 10, 20, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </div>
  );
}
