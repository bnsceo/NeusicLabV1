'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CyvoraPageHeader from '@/components/CyvoraPageHeader';
import { inferMissionBlueprint } from '@/lib/missionBlueprint';
import { buildHarnessPlan, type HarnessPlan } from '@/lib/harnessPlan';
import { clearDemoClientState, reloadFreshDemoPage } from '@/lib/demoClient';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';
import { buildShareableUrl, readNumericQueryParam } from '@/lib/viewState';

interface Briefing {
  objective: string;
  agents: { name: string; task: string; output: string }[];
  status: 'pending' | 'approved' | 'abandoned';
  timestamp: string;
}

interface HeadquartersData {
  totals: {
    companies: number;
    departments: number;
    teams: number;
    agents: number;
    tasks?: number;
    approvals?: number;
  };
  executive_ai?: {
    name: string;
    role: string;
    status: string;
  };
  companies?: HeadquartersCompany[];
}

type HeadquartersAgent = {
  id: number;
  agent_name: string;
  task_type?: string;
};

type HeadquartersTeam = {
  id: number;
  name: string;
  description?: string;
  agents: HeadquartersAgent[];
};

type HeadquartersDepartment = {
  id: number;
  name: string;
  description?: string;
  teams: HeadquartersTeam[];
};

type HeadquartersCompany = {
  id: number;
  name: string;
  description?: string;
  brand_color?: string;
  status?: string;
  connectors?: any[];
  tasks?: any[];
  approvals?: any[];
  outputs?: any[];
  departments: HeadquartersDepartment[];
};

type CompanyDetail = HeadquartersCompany & {
  connectors?: any[];
  activity?: any[];
};

interface SelfCodingRequest {
  id: number;
  request: string;
  stage: string;
  approval_state: string;
  qa_confidence: number;
  updated_at: string;
}

interface ExecutionRun {
  id: number;
  request_id: number;
  mission_id?: number | null;
  company_id?: number | null;
  goal: string;
  runtime_mode: string;
  status: string;
  rollback_state: string;
  paid_ai: boolean;
  mock_mode: boolean;
  started_at: string;
  completed_at?: string | null;
  runtime_plan: HarnessPlan;
  error_message?: string | null;
}

type DashboardPrefs = {
  compactFeed: boolean;
  showVisionBridge: boolean;
  emphasizeApprovals: boolean;
};

const operations = [
  {
    title: 'Research Department mapped a marketplace opportunity',
    meta: 'Product Research · Etsy print-on-demand',
    tone: 'cyan',
  },
  {
    title: 'Publishing workflow waiting for founder approval',
    meta: 'Approval Queue · Content Studio',
    tone: 'amber',
  },
  {
    title: 'War Room health sweep completed without critical incidents',
    meta: 'Reliability · Global habitat',
    tone: 'emerald',
  },
];

const missionPresets = [
  'I want to build a YouTube business.',
  'I want to build a software lab.',
  'I want to build a marketplace division.',
  'I want to build a consulting group.',
];

const actionButtonBase =
  'inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm transition';
const actionButtonPrimary = `${actionButtonBase} cyvora-tactile font-semibold text-cyan-50 hover:translate-y-[-1px]`;
const actionButtonFilled = `${actionButtonBase} bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200`;
const actionButtonSecondary = `${actionButtonBase} cyvora-chip text-slate-200 hover:translate-y-[-1px]`;
const actionButtonOutline = `${actionButtonBase} cyvora-chip text-slate-200`;
const tileActionButton =
  'cyvora-tactile flex min-h-24 flex-col items-start justify-center rounded-2xl p-4 text-left';

export default function Home() {
  const runtimeInfo = getRuntimeModeInfo();
  const isDemoModeActive = runtimeInfo.mode === 'demo';
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [headquarters, setHeadquarters] = useState<HeadquartersData | null>(null);
  const [companyDetail, setCompanyDetail] = useState<CompanyDetail | null>(null);
  const [selfCodingRequests, setSelfCodingRequests] = useState<SelfCodingRequest[]>([]);
  const [executionRuns, setExecutionRuns] = useState<ExecutionRun[]>([]);
  const [selectedExecutionRunId, setSelectedExecutionRunId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tenants, setTenants] = useState<string[]>(['default']);
  const [currentTenant, setCurrentTenant] = useState('default');
  const [newTenantName, setNewTenantName] = useState('');
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [missionDraft, setMissionDraft] = useState('I want to build a YouTube business.');
  const [missionPlanApproved, setMissionPlanApproved] = useState(false);
  const [controlPanelCollapsed, setControlPanelCollapsed] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedOutputId, setSelectedOutputId] = useState<number | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileDetailKind, setMobileDetailKind] = useState<'company' | 'connector' | 'task' | 'output'>('company');
  const [shareLink, setShareLink] = useState('');
  const [urlHydrated, setUrlHydrated] = useState(false);
  const [prefs, setPrefs] = useState<DashboardPrefs>({
    compactFeed: false,
    showVisionBridge: false,
    emphasizeApprovals: true,
  });

  const pendingSelfCoding = selfCodingRequests.filter((request) => request.approval_state === 'pending').length;
  const activeCompanies = headquarters?.totals.companies || 0;
  const activeDepartments = headquarters?.totals.departments || 0;
  const activeTasks = headquarters?.totals.tasks || 0;
  const pendingApprovals = pendingSelfCoding + (headquarters?.totals.approvals || 0) + (briefing?.status === 'pending' ? 1 : 0);
  const modeSummary = `${runtimeInfo.label} · ${runtimeInfo.description}`;
  const missionBlueprint = useMemo(() => inferMissionBlueprint(missionDraft), [missionDraft]);
  const missionDraftBlueprint = useMemo(() => inferMissionBlueprint(goal), [goal]);
  const missionDraftRuntimePlan = useMemo(() => buildHarnessPlan(goal), [goal]);
  const selectedCompany = useMemo(() => {
    if (!headquarters?.companies?.length) return null;
    if (!selectedCompanyId) return headquarters.companies[0];
    return headquarters.companies.find((company) => company.id === selectedCompanyId) || headquarters.companies[0];
  }, [headquarters, selectedCompanyId]);
  const activeCompanyDetail = companyDetail || selectedCompany;
  const activeConnectors = useMemo(() => activeCompanyDetail?.connectors || [], [activeCompanyDetail?.connectors]);
  const activeTasksList = useMemo(() => activeCompanyDetail?.tasks || [], [activeCompanyDetail?.tasks]);
  const activeOutputsList = useMemo(() => activeCompanyDetail?.outputs || [], [activeCompanyDetail?.outputs]);
  const selectedExecutionRun = useMemo(
    () =>
      executionRuns.find((run) => run.id === selectedExecutionRunId) ||
      executionRuns[0] ||
      null,
    [executionRuns, selectedExecutionRunId]
  );
  const selectedConnector = useMemo(
    () => activeConnectors.find((connector: any) => connector.id === selectedConnectorId) || activeConnectors[0] || null,
    [activeConnectors, selectedConnectorId]
  );
  const selectedTask = useMemo(
    () => activeTasksList.find((task: any) => task.id === selectedTaskId) || activeTasksList[0] || null,
    [activeTasksList, selectedTaskId]
  );
  const selectedOutput = useMemo(
    () => activeOutputsList.find((output: any) => output.id === selectedOutputId) || activeOutputsList[0] || null,
    [activeOutputsList, selectedOutputId]
  );
  const recentCompanies = headquarters?.companies?.slice(0, 3) || [];
  const recentRequests = selfCodingRequests.slice(0, 3);
  const recentRuns = executionRuns.slice(0, 3);
  const recentOutputs = activeOutputsList.slice(0, 3);
  const blueprintDepartmentCount = missionBlueprint.departments.length;
  const blueprintTeamCount = missionBlueprint.departments.reduce(
    (total, department) => total + department.teams.length,
    0
  );
  const blueprintAgentCount = missionBlueprint.departments.reduce(
    (total, department) =>
      total + department.teams.reduce((teamTotal, team) => teamTotal + team.agents.length, 0),
    0
  );
  const selectedNodeTrail = useMemo(
    () =>
      buildSelectionBreadcrumbs(
        headquarters?.companies || [],
        selectedCompanyId,
        selectedDepartmentId,
        selectedTeamId,
        selectedAgentId
      ),
    [headquarters?.companies, selectedCompanyId, selectedDepartmentId, selectedTeamId, selectedAgentId]
  );
  const mobileDetail = useMemo(() => {
    switch (mobileDetailKind) {
      case 'connector':
        return selectedConnector
          ? {
              title: selectedConnector.name,
              subtitle: selectedConnector.connector_type,
              description: selectedConnector.summary || 'No connector summary.',
              badges: [selectedConnector.status, selectedConnector.connector_type],
            }
          : null;
      case 'task':
        return selectedTask
          ? {
              title: selectedTask.title,
              subtitle: selectedTask.workflow_stage,
              description: selectedTask.description || 'No task description.',
              badges: [selectedTask.priority, selectedTask.status],
            }
          : null;
      case 'output':
        return selectedOutput
          ? {
              title: selectedOutput.title,
              subtitle: selectedOutput.output_type,
              description: selectedOutput.summary || 'No output summary.',
              badges: [selectedOutput.status, selectedOutput.output_type],
            }
          : null;
      default:
        return activeCompanyDetail
          ? {
              title: activeCompanyDetail.name,
              subtitle: activeCompanyDetail.status || 'active',
              description: activeCompanyDetail.description || 'No company description.',
              badges: [
                `${activeCompanyDetail.departments?.length || 0} departments`,
                `${activeConnectors.length} connectors`,
                `${activeTasksList.length} tasks`,
              ],
            }
          : null;
    }
  }, [
    activeCompanyDetail,
    activeConnectors.length,
    activeTasksList.length,
    mobileDetailKind,
    selectedConnector,
    selectedOutput,
    selectedTask,
  ]);

  const missionStatus = useMemo(() => {
    if (!briefing || briefing.objective === 'No active mission') return 'No active mission';
    if (briefing.status === 'approved') return 'Approved';
    if (briefing.status === 'abandoned') return 'Abandoned';
    return 'Founder approval required';
  }, [briefing]);

  const fetchBriefing = async () => {
    try {
      const res = await fetch('/api/briefing');
      const data = await res.json();
      setBriefing(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHeadquarters = async () => {
    try {
      const res = await fetch('/api/headquarters');
      const data = await res.json();
      if (data?.totals) setHeadquarters(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchCompanyDetail = async (companyId: number) => {
    setCompanyLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      const data = await res.json();
      if (res.ok) {
        setCompanyDetail(data);
      } else {
        setCompanyDetail(null);
      }
    } catch (error) {
      console.error(error);
      setCompanyDetail(null);
    } finally {
      setCompanyLoading(false);
    }
  };

  const fetchSelfCodingRequests = async () => {
    try {
      const res = await fetch('/api/harness-engineering/requests');
      const data = await res.json();
      if (Array.isArray(data)) setSelfCodingRequests(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchExecutionRuns = async () => {
    try {
      const res = await fetch('/api/execution-runs?limit=6');
      const data = await res.json();
      if (Array.isArray(data)) {
        setExecutionRuns(data);
        setSelectedExecutionRunId((current) => {
          if (current && data.some((run) => run.id === current)) {
            return current;
          }
          return data[0]?.id ?? null;
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      if (Array.isArray(data)) setTenants(data);
    } catch {
      // Keep default tenant list if the tenant route is unavailable.
    }
  };

  useEffect(() => {
    const loadData = localStorage.getItem('loadMission');
    if (loadData) {
      try {
        const mission = JSON.parse(loadData);
        setBriefing(mission);
        localStorage.removeItem('loadMission');
      } catch {
        localStorage.removeItem('loadMission');
      }
    }

    fetchBriefing();
    fetchHeadquarters();
    fetchSelfCodingRequests();
    fetchExecutionRuns();
    fetchTenants();

    const savedDraft = localStorage.getItem('missionDraft');
    if (savedDraft) {
      setMissionDraft(savedDraft);
    }

    const storedPrefs = localStorage.getItem('dashboardPrefs');
    if (storedPrefs) {
      try {
        setPrefs((current) => ({ ...current, ...JSON.parse(storedPrefs) }));
      } catch {
        localStorage.removeItem('dashboardPrefs');
      }
    }
  }, []);

  useEffect(() => {
    if (!headquarters?.companies?.length) return;
    if (!selectedCompanyId || !headquarters.companies.some((company) => company.id === selectedCompanyId)) {
      setSelectedCompanyId(headquarters.companies[0].id);
    }
  }, [headquarters, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    void fetchCompanyDetail(selectedCompanyId);
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!activeCompanyDetail) return;
    const firstDepartment = activeCompanyDetail.departments?.[0];
    const department =
      activeCompanyDetail.departments?.find((item) => item.id === selectedDepartmentId) || firstDepartment;
    const firstTeam = department?.teams?.[0];
    const team = department?.teams?.find((item) => item.id === selectedTeamId) || firstTeam;
    const firstAgent = team?.agents?.[0];
    const agent = team?.agents?.find((item) => item.id === selectedAgentId) || firstAgent;
    const firstConnector = activeCompanyDetail.connectors?.[0];
    const firstTask = activeCompanyDetail.tasks?.[0];
    const firstOutput = activeCompanyDetail.outputs?.[0];
    setSelectedDepartmentId(department?.id || null);
    setSelectedTeamId(team?.id || null);
    setSelectedAgentId(agent?.id || null);
    setSelectedConnectorId(firstConnector?.id || null);
    setSelectedTaskId(firstTask?.id || null);
    setSelectedOutputId(firstOutput?.id || null);
  }, [activeCompanyDetail, selectedDepartmentId, selectedTeamId, selectedAgentId]);

  useEffect(() => {
    localStorage.setItem('dashboardPrefs', JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    localStorage.setItem('missionDraft', missionDraft);
  }, [missionDraft]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const companyId = readNumericQueryParam(window.location.search, 'company');
    const runId = readNumericQueryParam(window.location.search, 'run');
    const departmentId = readNumericQueryParam(window.location.search, 'department');
    const teamId = readNumericQueryParam(window.location.search, 'team');
    const agentId = readNumericQueryParam(window.location.search, 'agent');
    if (companyId !== null) {
      setSelectedCompanyId(companyId);
    }
    if (runId !== null) {
      setSelectedExecutionRunId(runId);
    }
    if (departmentId !== null) {
      setSelectedDepartmentId(departmentId);
    }
    if (teamId !== null) {
      setSelectedTeamId(teamId);
    }
    if (agentId !== null) {
      setSelectedAgentId(agentId);
    }
    setUrlHydrated(true);
  }, []);

  useEffect(() => {
    if (!urlHydrated || typeof window === 'undefined') return;
    const nextPath = buildShareableUrl(window.location.pathname, {
      company: selectedCompanyId,
      run: selectedExecutionRunId,
      department: selectedDepartmentId,
      team: selectedTeamId,
      agent: selectedAgentId,
    });
    const nextUrl = `${window.location.origin}${nextPath}`;
    setShareLink(nextUrl);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.replaceState(null, '', nextPath);
    }
  }, [selectedCompanyId, selectedExecutionRunId, selectedDepartmentId, selectedTeamId, selectedAgentId, urlHydrated]);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setLogs((prev) => [...prev, data.message]);
      } else if (data.type === 'start') {
        setLogs([]);
        setIsStreaming(true);
      } else if (data.type === 'done') {
        setIsStreaming(false);
        setBriefing(data.briefing);
        fetchHeadquarters();
        fetchExecutionRuns();
      } else if (data.type === 'error') {
        setLogs((prev) => [...prev, `Error: ${data.message}`]);
      }
    };
    es.onerror = () => {
      es.close();
      setIsStreaming(false);
    };
    return () => es.close();
  }, []);

  const submitMission = async (objective: string) => {
    if (isDemoModeActive) {
      alert('The public demo is read-only. Use Reset demo to refresh the showcase.');
      return;
    }
    if (!objective.trim()) return;
    setSubmitting(true);
    setLogs([]);
    try {
      const approvedRequest = await ensureApprovedMissionRequest(objective);
      const res = await fetch('/api/start-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: approvedRequest.request,
          harness_request_id: approvedRequest.id,
          runtime_plan: approvedRequest.runtime_plan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error: ${data.error}`);
      } else {
        setModalOpen(false);
        setGoal('');
        setMissionDraft(objective);
        if (typeof data.company_id === 'number') {
          setSelectedCompanyId(data.company_id);
        }
      }
    } catch {
      alert('Failed to start mission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewMission = async () => {
    await submitMission(goal);
  };

  const ensureApprovedMissionRequest = async (objective: string) => {
    const normalizedObjective = objective.trim().toLowerCase();
    const requestedPlan = buildHarnessPlan(objective);
    const matchingApproved = selfCodingRequests.find(
      (request) =>
        request.approval_state === 'approved' &&
        request.request.trim().toLowerCase() === normalizedObjective
    );
    if (matchingApproved) {
      return { id: matchingApproved.id, request: matchingApproved.request, runtime_plan: buildHarnessPlan(matchingApproved.request) };
    }

    const matchingExisting = selfCodingRequests.find(
      (request) => request.request.trim().toLowerCase() === normalizedObjective
    );

    let requestRecord = matchingExisting;
    if (!requestRecord) {
      const createRes = await fetch('/api/self-coding/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: objective.trim() }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        throw new Error(created.error || 'Failed to create Harness Engineering request');
      }
      await fetchSelfCodingRequests();
      requestRecord = created;
    }

    if (!requestRecord) {
      throw new Error('Failed to resolve Harness Engineering request');
    }

    const resolvedRequest = requestRecord;
    if (!resolvedRequest) {
      throw new Error('Failed to resolve Harness Engineering request');
    }

    if (resolvedRequest.approval_state !== 'approved') {
      const approveRes = await fetch(`/api/harness-engineering/requests/${resolvedRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', runtime_plan: requestedPlan }),
      });
      const approved = await approveRes.json();
      if (!approveRes.ok) {
        throw new Error(approved.error || 'Failed to approve Harness Engineering request');
      }
      await fetchSelfCodingRequests();
      requestRecord = approved;
    }

    return {
      id: resolvedRequest.id,
      request: resolvedRequest.request,
      runtime_plan: requestedPlan,
    };
  };

  const handleWarRoom = async () => {
    try {
      const res = await fetch('/api/warroom');
      const data = await res.json();
      alert(`Incidents:\n${data.map((item: any) => `${item.title} (${item.severity})`).join('\n')}`);
    } catch {
      alert('Failed to load War Room');
    }
  };

  const handleAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      alert(
        `Analytics:\nTotal Calls: ${data.totalCalls}\nTop Agents: ${data.topAgents
          .map((agent: any) => `${agent.name}: ${agent.calls}`)
          .join(', ')}`
      );
    } catch {
      alert('Failed to load analytics');
    }
  };

  const copyShareableView = async () => {
    if (typeof window === 'undefined') return;
    const nextLink =
      shareLink ||
      `${window.location.origin}${buildShareableUrl(window.location.pathname, {
        company: selectedCompanyId,
        run: selectedExecutionRunId,
      })}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Cyvora',
          text: 'Open this Cyvora command view',
          url: nextLink,
        });
        return;
      } catch {
        // Clipboard fallback below.
      }
    }
    try {
      await navigator.clipboard.writeText(nextLink);
      alert('Current view link copied');
    } catch {
      alert(nextLink);
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to reset demo showcase');
        return;
      }
      clearDemoClientState();
      await Promise.all([fetchBriefing(), fetchHeadquarters(), fetchSelfCodingRequests(), fetchExecutionRuns()]);
      reloadFreshDemoPage();
      alert('Demo showcase reset');
    } catch {
      alert('Failed to reset demo showcase');
    }
  };

  const switchTenant = async (tenant: string) => {
    if (isDemoModeActive) {
      alert('The public demo is read-only. Tenant switching is disabled there.');
      return;
    }
    if (tenant === currentTenant) return;
    const res = await fetch('/api/tenant/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant }),
    });
    if (res.ok) {
      setCurrentTenant(tenant);
      window.location.reload();
    }
  };

  const createTenant = async () => {
    if (isDemoModeActive) {
      alert('The public demo is read-only. Create tenants in local mode instead.');
      return;
    }
    if (!newTenantName.trim()) return;
    const res = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTenantName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setTenants(data.tenants);
      setNewTenantName('');
      setShowCreateTenant(false);
      await switchTenant(newTenantName.trim());
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <section className="cyvora-glass rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                System Mode
              </p>
              <p className="mt-1 text-sm text-slate-200">{modeSummary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="emerald">Approvals required</Pill>
              <Pill tone="cyan">{runtimeInfo.readOnlyDemo ? 'Demo tenant' : 'Local data only'}</Pill>
              <Pill tone="amber">{briefing?.status === 'approved' ? 'Mission approved' : 'Founder review pending'}</Pill>
            </div>
          </div>
        </section>

        <CyvoraPageHeader
          eyebrow="Founder overview"
          title="Command Center"
          description="See what your AI organization is doing, what needs approval, which companies are active, and what the Executive AI recommends next."
        >
          <div className="flex flex-wrap gap-2">
            <Pill tone="cyan">Founder intent first</Pill>
            <Pill tone="emerald">Headquarters view</Pill>
            <Pill tone="blue">Dry-run safe</Pill>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setModalOpen(true)}
              disabled={isDemoModeActive}
              className={`${actionButtonPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isDemoModeActive ? 'Demo is read-only' : 'New idea'}
            </button>
            {isDemoModeActive ? (
              <button
                onClick={handleResetDemo}
                className={actionButtonSecondary}
              >
                Reset demo
              </button>
            ) : null}
          </div>
          <div className="cyvora-glass rounded-2xl p-4 lg:w-[332px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-cyan-100">Executive AI</p>
                  <p className="mt-1 text-xs text-cyan-100/75">Central intelligence online</p>
                </div>
                <span className="cyvora-chip flex items-center gap-2 rounded-full px-3 py-1 text-xs text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
                  Online
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <select
                  value={currentTenant}
                  onChange={(event) => switchTenant(event.target.value)}
                  className="cyvora-tactile min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                >
                  {tenants.map((tenant) => (
                    <option key={tenant} value={tenant}>
                      {tenant}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreateTenant(true)}
                  className={`${actionButtonSecondary} px-3`}
                >
                  New
                </button>
              </div>

              <div className="mt-4 cyvora-tactile rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Control panel</p>
                  <button
                    type="button"
                    onClick={() => setControlPanelCollapsed((current) => !current)}
                    className="cyvora-chip rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:translate-y-[-1px]"
                  >
                    {controlPanelCollapsed ? 'Show' : 'Hide'}
                  </button>
                </div>
                {!controlPanelCollapsed && (
                  <div className="mt-3 space-y-2.5">
                    <ToggleRow
                      label="Compact activity feed"
                      description="Reduce the stream to denser mission updates."
                      checked={prefs.compactFeed}
                      onChange={() => setPrefs((current) => ({ ...current, compactFeed: !current.compactFeed }))}
                    />
                    <ToggleRow
                      label="Deep detail"
                      description="Show the expanded hierarchy and execution panels."
                      checked={prefs.showVisionBridge}
                      onChange={() =>
                        setPrefs((current) => ({ ...current, showVisionBridge: !current.showVisionBridge }))
                      }
                    />
                    <ToggleRow
                      label="Emphasize approvals"
                      description="Keep pending approvals visually loud."
                      checked={prefs.emphasizeApprovals}
                      onChange={() =>
                        setPrefs((current) => ({ ...current, emphasizeApprovals: !current.emphasizeApprovals }))
                      }
                    />
                  </div>
                )}
              </div>
            </div>
        </CyvoraPageHeader>

        <section className="mt-6 grid gap-3 md:hidden">
          <div className="cyvora-glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Mobile control</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <MiniMetric label="Companies" value={String(activeCompanies)} />
              <MiniMetric label="Approvals" value={String(pendingApprovals)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/headquarters" className={actionButtonOutline}>
                HQ
              </Link>
              <Link href="/harness-engineering" className={actionButtonOutline}>
                Harness
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('company');
                  setMobileDetailOpen(true);
                }}
                className={actionButtonOutline}
              >
                Inspect
              </button>
              {isDemoModeActive ? (
                <button onClick={handleResetDemo} className={actionButtonOutline}>
                  Reset
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="sticky bottom-4 z-30 mt-4 md:hidden">
          <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/95 p-4 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">Current node</p>
                <p className="mt-1 truncate text-sm font-medium text-white">
                  {selectedNodeTrail.length ? selectedNodeTrail.join(' / ') : 'No node selected'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {activeCompanyDetail?.name || 'Choose a company'} · {activeConnectors.length} connectors · {activeTasksList.length} tasks
                </p>
              </div>
              <Pill tone="cyan">Live</Pill>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('company');
                  setMobileDetailOpen(true);
                }}
                className={`${actionButtonOutline} px-3`}
              >
                Inspect
              </button>
              <button
                type="button"
                onClick={copyShareableView}
                className={`${actionButtonOutline} px-3`}
              >
                Share link
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:hidden">
          <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Mobile command surface</p>
                <h2 className="mt-1 text-lg font-semibold">Phone-first control</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Quick actions, live status, and the current org snapshot stay within thumb reach.
                </p>
              </div>
              <Pill tone="cyan">PWA ready</Pill>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <MiniMetric label="Departments" value={String(activeDepartments)} />
                <MiniMetric label="Tasks" value={String(activeTasks)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileDetailKind('company');
                    setMobileDetailOpen(true);
                  }}
                  className={tileActionButton}
                >
                  <p className="text-sm font-semibold text-white">Company</p>
                  <p className="mt-1 text-xs text-slate-400">Open the active company</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileDetailKind('connector');
                    setMobileDetailOpen(true);
                  }}
                  className={tileActionButton}
                >
                  <p className="text-sm font-semibold text-white">Connector</p>
                  <p className="mt-1 text-xs text-slate-400">Inspect live system links</p>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileDetailKind('task');
                    setMobileDetailOpen(true);
                  }}
                  className={tileActionButton}
                >
                  <p className="text-sm font-semibold text-white">Task</p>
                  <p className="mt-1 text-xs text-slate-400">Open the current work item</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileDetailKind('output');
                    setMobileDetailOpen(true);
                  }}
                  className={tileActionButton}
                >
                  <p className="text-sm font-semibold text-white">Output</p>
                  <p className="mt-1 text-xs text-slate-400">See produced artifacts</p>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setModalOpen(true)}
                  disabled={isDemoModeActive}
                  className={`${actionButtonPrimary} min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isDemoModeActive ? 'Demo locked' : 'New idea'}
                </button>
                {isDemoModeActive ? (
                  <button
                    onClick={handleResetDemo}
                    className={`${actionButtonSecondary} min-h-12 w-full`}
                  >
                    Reset demo
                  </button>
                ) : (
                  <Link href="/security" className={`${actionButtonSecondary} min-h-12 w-full`}>
                    War room
                  </Link>
                )}
              </div>
              {selectedExecutionRun ? (
                <div className="cyvora-glass rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Latest run</p>
                  <p className="mt-2 text-sm font-medium text-white">{selectedExecutionRun.goal}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone="emerald">{selectedExecutionRun.status}</Pill>
                    <Pill tone="amber">{selectedExecutionRun.runtime_mode}</Pill>
                    <Pill tone="blue">{selectedExecutionRun.mock_mode ? 'mock-safe' : 'live'}</Pill>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="cyvora-glass-strong rounded-2xl p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Mission intake
                </p>
                <h2 className="mt-2 text-[20px] font-semibold">State one business objective</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                  The founder describes the outcome once. Cyvora expands it into companies,
                  departments, teams, agents, tasks, connectors, and outputs.
                </p>
              </div>
              <Pill tone="emerald">Founder intent first</Pill>
            </div>

            <textarea
              className="cyvora-tactile mt-5 min-h-40 w-full rounded-2xl p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
              placeholder="Example: I want to build a YouTube business."
              value={missionDraft}
              onChange={(event) => setMissionDraft(event.target.value)}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {missionPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMissionDraft(preset)}
                  className="cyvora-chip rounded-full px-3 py-1.5 text-xs text-slate-200 transition"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setGoal(missionDraft);
                  setModalOpen(true);
                }}
                className={actionButtonSecondary}
              >
                Review mission
              </button>
              <button
                onClick={() => submitMission(missionDraft)}
                disabled={submitting || !missionDraft.trim() || isDemoModeActive}
                className={`${actionButtonPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isDemoModeActive ? 'Demo is read-only' : submitting ? 'Starting...' : 'Launch mission'}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Departments" value={String(blueprintDepartmentCount)} />
              <MiniMetric label="Teams" value={String(blueprintTeamCount)} />
              <MiniMetric label="Agents" value={String(blueprintAgentCount)} />
            </div>
          </div>

          <div className="cyvora-glass rounded-2xl p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Executive briefing
                </p>
                <h2 className="mt-2 text-[20px] font-semibold">The next objective grows the org</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  This preview stays compact on the home page. Full hierarchy and execution detail
                  live in the dedicated pages.
                </p>
              </div>
              <Pill tone="amber">{missionBlueprint.companyName}</Pill>
            </div>

            <div className="mt-5 space-y-3">
              <div className="cyvora-tactile rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">Planned company</p>
                    <h3 className="text-lg font-semibold text-white">{missionBlueprint.companyName}</h3>
                    <p className="mt-1 text-sm text-slate-400">{missionBlueprint.description}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    objective-linked
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {missionBlueprint.departments.slice(0, 3).map((department) => (
                    <div key={department.name} className="cyvora-glass rounded-xl p-3">
                      <p className="text-sm font-semibold text-cyan-100">{department.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{department.description}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {department.teams.length} teams ·{' '}
                        {department.teams.reduce((count, team) => count + team.agents.length, 0)} agents
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <DetailPanel
                  title="Connectors"
                  subtitle="Needed to run"
                  items={missionBlueprint.connectors.slice(0, 3)}
                  emptyLabel="No connector inference yet"
                />
                <DetailPanel
                  title="Tasks"
                  subtitle="Current queue"
                  items={activeTasksList.slice(0, 3).map((task) => `${task.title} · ${task.workflow_stage}`)}
                  emptyLabel={companyLoading ? 'Loading tasks...' : 'No tasks yet'}
                />
                <DetailPanel
                  title="Links"
                  subtitle="Drill-down pages"
                  items={['/headquarters', '/harness-engineering', '/security']}
                  emptyLabel="No links"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href="/headquarters" className={actionButtonOutline}>
                  Open HQ
                </Link>
                <Link href="/harness-engineering" className={actionButtonOutline}>
                  Open Harness
                </Link>
                <Link href="/security" className={actionButtonOutline}>
                  Open War Room
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Companies" value={activeCompanies.toString()} helper="Autonomous businesses" tone="cyan" />
          <Metric label="Departments" value={activeDepartments.toString()} helper="Operating divisions" tone="emerald" />
          <Metric label="Tasks" value={activeTasks.toString()} helper="Work in motion" tone="blue" />
          <Metric
            label="Approvals"
            value={pendingApprovals.toString()}
            helper="Waiting on founder"
            tone={prefs.emphasizeApprovals ? 'amber' : 'cyan'}
          />
        </section>

        {prefs.showVisionBridge && (
          <section className="mt-6 cyvora-glass rounded-2xl p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Vision bridge
                </p>
                <h2 className="mt-2 text-[20px] font-semibold">Turn founder intent into an operating system</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                  This is the missing layer between a vision and a working business structure:
                  capture the idea, map the organization, then route execution through approvals.
                </p>
              </div>
              <Pill tone="emerald">Vision-first flow</Pill>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <BridgeCard
                step="01"
                title="Capture the vision"
                text="A founder statement becomes the seed for a company."
              />
              <BridgeCard
                step="02"
                title="Shape the organization"
                text="Departments, teams, and agents appear around the mission."
              />
              <BridgeCard
                step="03"
                title="Run execution safely"
                text="Approvals, logs, and War Room monitoring keep control visible."
              />
            </div>
          </section>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <div className="cyvora-glass-strong rounded-2xl p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Active companies
                </p>
                <h2 className="mt-2 text-[20px] font-semibold">Current operating portfolio</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  The home page stays compact. Use Headquarters for full hierarchy drill-down.
                </p>
              </div>
              <Pill tone="cyan">{headquarters?.executive_ai?.status || 'online'}</Pill>
            </div>

            <div className="mt-5 grid gap-3">
              {recentCompanies.length ? (
                recentCompanies.map((company) => {
                  const departmentCount = company.departments?.length || 0;
                  const teamCount = countTeams(company.departments);
                  const agentCount = countAgents(company.departments);
                  return (
                    <div key={company.id} className="cyvora-tactile rounded-2xl p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-1 h-10 w-10 rounded-xl ring-1 ring-white/10"
                            style={{ backgroundColor: company.brand_color || '#38bdf8' }}
                          />
                          <div>
                            <p className="text-sm font-semibold text-white">{company.name}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">{company.description}</p>
                          </div>
                        </div>
                        <Link
                          href={`/headquarters${selectedCompanyId === company.id ? `?company=${company.id}` : ''}`}
                          className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-200 transition"
                        >
                          Open
                        </Link>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <CountPill value={`${departmentCount} departments`} />
                        <CountPill value={`${teamCount} teams`} />
                        <CountPill value={`${agentCount} agents`} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="cyvora-tactile rounded-xl p-4 text-sm text-slate-400">
                  No headquarters data yet.
                </p>
              )}
            </div>
          </div>

          <div className="cyvora-glass rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Live operations</h2>
                <p className="mt-1 text-sm text-slate-400">Mission, approvals, logs, and current runtime state</p>
              </div>
              {isStreaming ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                  Streaming
                </span>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              <div className="cyvora-tactile rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current mission</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {loading ? 'Loading mission state...' : briefing?.objective || 'No active mission'}
                    </h3>
                  </div>
                  <StatusPill status={missionStatus} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {briefing && briefing.agents.length > 0
                    ? `${briefing.agents.length} agents assigned · ${pendingApprovals} approvals waiting`
                    : 'Start with a business objective and the Executive AI will create the plan.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/headquarters" className={actionButtonOutline}>
                    Headquarters
                  </Link>
                  <Link href="/harness-engineering" className={actionButtonOutline}>
                    Harness
                  </Link>
                  <Link href="/security" className={actionButtonOutline}>
                    War Room
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <DetailPanel
                  title="Approvals"
                  subtitle="Waiting on founder"
                  items={recentRequests.map((request) => `${request.request} · ${request.approval_state}`)}
                  emptyLabel={recentRequests.length ? 'No approvals pending' : 'No requests yet'}
                />
                <DetailPanel
                  title="Recent outputs"
                  subtitle="Latest artifacts"
                  items={recentOutputs.map((output) => `${output.title} · ${output.status}`)}
                  emptyLabel={companyLoading ? 'Loading outputs...' : 'No outputs yet'}
                />
              </div>

              <div className="cyvora-tactile rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{activeCompanyDetail?.name || 'No company selected'}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {activeCompanyDetail?.description || 'Choose a live company in Headquarters to inspect deeper data.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="cyan">{activeCompanyDetail?.departments?.length || 0} departments</Pill>
                    <Pill tone="emerald">{activeTasksList.length} tasks</Pill>
                    <Pill tone="amber">{activeOutputsList.length} outputs</Pill>
                  </div>
                </div>
                <div className="mt-4 max-h-40 space-y-2 overflow-y-auto pr-1">
                  {(logs.length > 0 ? logs.slice(prefs.compactFeed ? -4 : -6) : operations.map((item) => `${item.title} · ${item.meta}`)).map(
                    (entry, index) => (
                      <ActivityRow key={`${entry}-${index}`} title={entry} meta="Mission stream" tone="cyan" />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            title="Mission Review"
            description="Open the composed objective and approve the organization plan."
            action="Open"
            onClick={() => {
              setGoal(missionDraft);
              setMissionPlanApproved(false);
              setModalOpen(true);
            }}
          />
          <ActionCard
            title="Headquarters"
            description="Inspect the nested organization map."
            action="Open"
            href="/headquarters"
          />
          <ActionCard
            title="Harness Engineering"
            description="Request software changes from the autonomous execution harness."
            action="Open"
            href="/harness-engineering"
          />
          <ActionCard
            title="War Room"
            description="Review incidents, repairs, and reliability signals."
            action="Inspect"
            onClick={handleWarRoom}
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="cyvora-glass-strong rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Approvals and risks</h2>
                <p className="mt-1 text-sm text-slate-400">Factory-building requests stay visible before execution</p>
              </div>
              <Link href="/harness-engineering" className={`${actionButtonOutline} px-3 py-2`}>
                Manage
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {recentRequests.length === 0 ? (
                <p className="cyvora-tactile rounded-xl p-4 text-sm text-slate-400">
                  No Harness Engineering requests yet.
                </p>
              ) : (
                recentRequests.map((request) => (
                  <div key={request.id} className="cyvora-tactile rounded-xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="max-w-xl text-sm font-medium text-white">{request.request}</p>
                      <span className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-300">
                        {request.stage}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      QA {request.qa_confidence}% · {request.approval_state}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="cyvora-glass rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Recent runs</h2>
                <p className="mt-1 text-sm text-slate-400">Execution timeline and rollback state</p>
              </div>
              <button onClick={handleAnalytics} className={`${actionButtonOutline} px-3 py-2`}>
                Analytics
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="API cost" value="$0.00" />
              <MiniMetric label="Health" value="Nominal" />
              <MiniMetric label="Runtime" value="2.3s" />
              <MiniMetric label="Failures" value="0" />
            </div>

            <div className="mt-4 space-y-3">
              {recentRuns.length === 0 ? (
                <p className="cyvora-tactile rounded-xl p-4 text-sm text-slate-500">
                  No execution records yet.
                </p>
              ) : (
                recentRuns.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedExecutionRunId(run.id)}
                    className={`cyvora-tactile w-full rounded-xl p-4 text-left transition ${
                      selectedExecutionRun?.id === run.id
                        ? 'border-cyan-300/50 bg-cyan-300/10'
                        : 'border-white/10 hover:border-cyan-300/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{run.goal}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Run #{run.id} · request #{run.request_id} · {new Date(run.started_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ExecutionBadge status={run.status} />
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                          {run.rollback_state}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill tone="cyan">{run.runtime_mode}</Pill>
                      <Pill tone="emerald">{run.mock_mode ? 'mock-safe' : 'live'}</Pill>
                      <Pill tone="amber">{run.paid_ai ? 'paid ai enabled' : 'paid ai off'}</Pill>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {modalOpen && (
        <Modal
          title="New Mission"
          onClose={() => {
            setModalOpen(false);
            setGoal('');
            setMissionPlanApproved(false);
          }}
        >
          <p className="text-sm text-slate-400">
            Describe the business outcome. The Executive AI will decompose it into company,
            department, agent, and approval work.
          </p>
          <textarea
            className="cyvora-tactile mt-4 w-full resize-none rounded-xl p-4 text-sm leading-6 text-white outline-none focus:border-cyan-300/60"
            rows={4}
            placeholder="Example: I want to build a YouTube business around AI education."
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
          <div className="cyvora-glass mt-4 rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Blueprint preview</p>
                <h3 className="mt-1 text-sm font-semibold text-white">{missionDraftBlueprint.companyName}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">{missionDraftBlueprint.description}</p>
              </div>
              <label className={`flex items-center gap-2 text-sm ${goal.trim() ? 'text-slate-200' : 'cursor-not-allowed text-slate-500'}`}>
                <input
                  type="checkbox"
                  checked={missionPlanApproved}
                  disabled={!goal.trim() || isDemoModeActive}
                  onChange={(event) => setMissionPlanApproved(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30 disabled:cursor-not-allowed"
                />
                I have reviewed the plan
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="cyvora-tactile rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Connectors</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missionDraftBlueprint.connectors.map((connector) => (
                    <span
                      key={connector}
                      className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100"
                    >
                      {connector}
                    </span>
                  ))}
                </div>
              </div>
              <div className="cyvora-tactile rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Runtime plan</p>
                <div className="mt-2 space-y-2 text-xs leading-5 text-slate-300">
                  <p>Sandbox: {missionDraftRuntimePlan.sandbox_scope.join(' · ')}</p>
                  <p>Permissions: {missionDraftRuntimePlan.permissions.join(' · ')}</p>
                  <p>Validation: {missionDraftRuntimePlan.validation_checks.join(' · ')}</p>
                  <p>Rollback: {missionDraftRuntimePlan.rollback_path.join(' · ')}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => {
                setModalOpen(false);
                setGoal('');
                setMissionPlanApproved(false);
              }}
              className={actionButtonOutline}
            >
              Cancel
            </button>
            <button
              onClick={handleNewMission}
              disabled={submitting || !goal.trim() || !missionPlanApproved || isDemoModeActive}
              className={`${actionButtonFilled} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isDemoModeActive
                ? 'Demo is read-only'
                : submitting
                  ? 'Deploying...'
                  : missionPlanApproved
                    ? 'Decree mission'
                    : 'Approve plan to continue'}
            </button>
          </div>
        </Modal>
      )}

      {showCreateTenant && (
        <Modal title="New Tenant" onClose={() => { setShowCreateTenant(false); setNewTenantName(''); }}>
          <input
            type="text"
            placeholder="Tenant name"
            value={newTenantName}
            onChange={(event) => setNewTenantName(event.target.value)}
            className="cyvora-tactile w-full rounded-xl p-4 text-sm text-white outline-none focus:border-cyan-300/60"
          />
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => { setShowCreateTenant(false); setNewTenantName(''); }}
              className={actionButtonOutline}
            >
              Cancel
            </button>
            <button
              onClick={createTenant}
              disabled={isDemoModeActive}
              className={`${actionButtonFilled} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isDemoModeActive ? 'Demo is read-only' : 'Create'}
            </button>
          </div>
        </Modal>
      )}

      {mobileDetailOpen && mobileDetail ? (
        <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
          <div className="mx-auto max-w-2xl rounded-t-3xl cyvora-glass-strong p-4">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/15" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Quick detail</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{mobileDetail.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{mobileDetail.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                className="cyvora-chip rounded-lg px-3 py-1 text-sm text-slate-200"
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{mobileDetail.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {mobileDetail.badges.map((badge) => (
                <Pill key={badge} tone="cyan">
                  {badge}
                </Pill>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('company');
                  setMobileDetailOpen(true);
                }}
                className={`cyvora-chip rounded-xl px-3 py-2 text-sm ${mobileDetailKind === 'company' ? 'cyvora-neumo-pressed text-cyan-100' : 'text-slate-200'}`}
              >
                Company
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('connector');
                  setMobileDetailOpen(true);
                }}
                className={`cyvora-chip rounded-xl px-3 py-2 text-sm ${mobileDetailKind === 'connector' ? 'cyvora-neumo-pressed text-cyan-100' : 'text-slate-200'}`}
              >
                Connector
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('task');
                  setMobileDetailOpen(true);
                }}
                className={`cyvora-chip rounded-xl px-3 py-2 text-sm ${mobileDetailKind === 'task' ? 'cyvora-neumo-pressed text-cyan-100' : 'text-slate-200'}`}
              >
                Task
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('output');
                  setMobileDetailOpen(true);
                }}
                className={`cyvora-chip rounded-xl px-3 py-2 text-sm ${mobileDetailKind === 'output' ? 'cyvora-neumo-pressed text-cyan-100' : 'text-slate-200'}`}
              >
                Output
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'cyan' | 'emerald' | 'blue' | 'amber';
}) {
  const tones = {
    cyan: 'text-cyan-200',
    emerald: 'text-emerald-200',
    blue: 'text-blue-200',
    amber: 'text-amber-200',
  };

  return (
    <div
      className={`cyvora-glass rounded-2xl p-5 ${
        tone === 'cyan'
          ? 'border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-slate-950 to-slate-950'
          : tone === 'emerald'
            ? 'border-emerald-300/15 bg-gradient-to-br from-emerald-300/10 via-slate-950 to-slate-950'
              : tone === 'blue'
                ? 'border-blue-300/15 bg-gradient-to-br from-blue-300/10 via-slate-950 to-slate-950'
                : 'border-amber-300/15 bg-gradient-to-br from-amber-300/10 via-slate-950 to-slate-950'
      }`}
    >
      <p className={`text-[20px] font-semibold ${tones[tone]}`}>{value}</p>
      <p className="mt-2 text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isReady = status === 'Approved' || status === 'No active mission';
  return (
    <span
      className={`cyvora-chip rounded-full px-3 py-1 text-xs ${
        isReady
          ? 'border-emerald-300/20 text-emerald-200'
          : 'border-amber-300/20 text-amber-200'
      }`}
    >
      {status}
    </span>
  );
}

function ActivityRow({
  title,
  meta,
  tone,
}: {
  title: string;
  meta: string;
  tone: string;
}) {
  const dot = tone === 'amber' ? 'bg-amber-300' : tone === 'emerald' ? 'bg-emerald-300' : 'bg-cyan-300';
  return (
    <div className="cyvora-glass rounded-xl p-4">
      <div className="flex gap-3">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dot}`} />
        <div>
          <p className="text-sm text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  action,
  href,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex h-full flex-col justify-between gap-5">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <span className="text-sm font-medium text-cyan-200">{action}</span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="cyvora-tactile rounded-2xl p-5 transition hover:translate-y-[-1px] hover:shadow-[0_22px_40px_rgba(0,0,0,0.32)]">
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className="cyvora-tactile rounded-2xl p-5 text-left transition hover:translate-y-[-1px] hover:shadow-[0_22px_40px_rgba(0,0,0,0.32)]"
    >
      {content}
    </button>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="cyvora-tactile rounded-xl p-3">
      <p className="text-sm font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="cyvora-glass-strong w-full max-w-lg rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-[20px] font-semibold">{title}</h2>
          <button onClick={onClose} className="cyvora-chip rounded-lg px-3 py-1 text-sm text-slate-200">
            Close
          </button>
        </div>
        {children}
      </div>
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

  return <span className={`cyvora-chip rounded-full px-3 py-1 text-xs ${styles[tone]}`}>{children}</span>;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="cyvora-tactile grid w-full grid-cols-[minmax(0,1fr)_48px] items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:translate-y-[-1px]"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <span
        className={`relative h-7 w-12 justify-self-end rounded-full border transition ${
          checked ? 'border-emerald-300/30 bg-emerald-300/20' : 'border-white/10 bg-white/5'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
            checked ? 'left-[23px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function BridgeCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="cyvora-glass rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{step}</p>
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

function DetailPanel({
  title,
  subtitle,
  items,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="cyvora-glass rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="cyvora-chip rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {items.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div key={item} className="cyvora-tactile rounded-lg px-3 py-2 text-sm text-slate-200">
              {item}
            </div>
          ))
        ) : (
          <p className="cyvora-tactile rounded-lg px-3 py-3 text-sm text-slate-500">
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
}

function ExecutionBadge({ status }: { status: string }) {
  const style =
    status === 'completed'
      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
      : status === 'failed'
        ? 'border-rose-300/20 bg-rose-300/10 text-rose-200'
        : status === 'running'
          ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'
          : 'border-amber-300/20 bg-amber-300/10 text-amber-200';
  return <span className={`rounded-full border px-3 py-1 text-xs ${style}`}>{status}</span>;
}

function CountPill({ value }: { value: string }) {
  return <span className="cyvora-chip rounded-full px-3 py-1 text-xs text-slate-300">{value}</span>;
}

function countTeams(departments?: HeadquartersDepartment[]) {
  return departments?.reduce((total, department) => total + (department.teams?.length || 0), 0) || 0;
}

function countAgents(departments?: HeadquartersDepartment[]) {
  return departments?.reduce(
    (total, department) =>
      total + (department.teams?.reduce((teamTotal, team) => teamTotal + (team.agents?.length || 0), 0) || 0),
    0
  ) || 0;
}

function buildSelectionBreadcrumbs(
  companies: HeadquartersCompany[],
  companyId: number | null,
  departmentId: number | null,
  teamId: number | null,
  agentId: number | null
) {
  const breadcrumbs: string[] = [];
  const company = companies.find((item) => item.id === companyId);
  if (!company) return breadcrumbs;
  breadcrumbs.push(company.name);
  const department = company.departments?.find((item) => item.id === departmentId);
  if (!department) return breadcrumbs;
  breadcrumbs.push(department.name);
  const team = department.teams?.find((item) => item.id === teamId);
  if (!team) return breadcrumbs;
  breadcrumbs.push(team.name);
  const agent = team.agents?.find((item) => item.id === agentId);
  if (agent) breadcrumbs.push(agent.agent_name);
  return breadcrumbs;
}
