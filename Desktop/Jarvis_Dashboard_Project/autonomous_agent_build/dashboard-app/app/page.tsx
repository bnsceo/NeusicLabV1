'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import NavBar from '@/components/NavBar';
import { inferMissionBlueprint } from '@/lib/missionBlueprint';
import { buildHarnessPlan, type HarnessPlan } from '@/lib/harnessPlan';
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
  const [expandedCompanies, setExpandedCompanies] = useState<number[]>([]);
  const [expandedDepartments, setExpandedDepartments] = useState<number[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<number[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<number[]>([]);
  const [prefs, setPrefs] = useState<DashboardPrefs>({
    compactFeed: false,
    showVisionBridge: true,
    emphasizeApprovals: true,
  });

  const pendingSelfCoding = selfCodingRequests.filter((request) => request.approval_state === 'pending').length;
  const activeCompanies = headquarters?.totals.companies || 0;
  const activeDepartments = headquarters?.totals.departments || 0;
  const activeTasks = headquarters?.totals.tasks || 0;
  const pendingApprovals = pendingSelfCoding + (headquarters?.totals.approvals || 0) + (briefing?.status === 'pending' ? 1 : 0);
  const modeSummary = `${runtimeInfo.label} · ${runtimeInfo.description}`;
  const selectedCompany = useMemo(() => {
    if (!headquarters?.companies?.length) return null;
    if (!selectedCompanyId) return headquarters.companies[0];
    return headquarters.companies.find((company) => company.id === selectedCompanyId) || headquarters.companies[0];
  }, [headquarters, selectedCompanyId]);
  const activeCompanyDetail = companyDetail || selectedCompany;
  const missionBlueprint = useMemo(() => inferMissionBlueprint(missionDraft), [missionDraft]);
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
  const selectedRuntimePlan = selectedExecutionRun?.runtime_plan || null;
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
    setExpandedCompanies((current) =>
      current.includes(activeCompanyDetail.id) ? current : [...current, activeCompanyDetail.id]
    );
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
    const approvedRequest = selfCodingRequests.find(
      (request) =>
        request.approval_state === 'approved' &&
        request.request.trim().toLowerCase() === objective.trim().toLowerCase()
    );
    if (!approvedRequest) {
      alert('Approve a matching Harness Engineering request before starting execution.');
      return;
    }
    setSubmitting(true);
    setLogs([]);
    try {
      const res = await fetch('/api/start-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: approvedRequest.request,
          harness_request_id: approvedRequest.id,
          runtime_plan: buildHarnessPlan(approvedRequest.request),
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
    try {
      await navigator.clipboard.writeText(nextLink);
      alert('Current view link copied');
    } catch {
      alert(nextLink);
    }
  };

  const copySelectedRunPlan = async () => {
    if (typeof window === 'undefined' || !selectedExecutionRun || !selectedRuntimePlan) return;
    const planText = [
      `Goal: ${selectedExecutionRun.goal}`,
      `Sandbox scope: ${selectedRuntimePlan.sandbox_scope.join(' | ')}`,
      `Permissions: ${selectedRuntimePlan.permissions.join(' | ')}`,
      `Validation checks: ${selectedRuntimePlan.validation_checks.join(' | ')}`,
      `Rollback path: ${selectedRuntimePlan.rollback_path.join(' | ')}`,
      `Token ceiling: ${selectedRuntimePlan.token_cost_ceiling.tokens}`,
      `Cost ceiling: ${selectedRuntimePlan.token_cost_ceiling.cost_usd}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(planText);
      alert('Runtime plan copied');
    } catch {
      alert(planText);
    }
  };

  const handleRollbackRun = async (run: ExecutionRun) => {
    const reason = window.prompt(`Rollback run #${run.id}. Enter a reason:`, 'Founder requested rollback');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/execution-runs/${run.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to rollback run');
        return;
      }
      await fetchExecutionRuns();
      await fetchHeadquarters();
      alert(`Run #${run.id} rolled back`);
    } catch {
      alert('Failed to rollback run');
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
      await Promise.all([fetchBriefing(), fetchHeadquarters(), fetchSelfCodingRequests(), fetchExecutionRuns()]);
      alert('Demo showcase reset');
    } catch {
      alert('Failed to reset demo showcase');
    }
  };

  const handleApprove = async (action: 'decree' | 'abandon') => {
    if (!briefing) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, objective: briefing.objective }),
      });
      const data = await res.json();
      if (res.ok) {
        setBriefing(data);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Failed to approve mission');
    } finally {
      setSubmitting(false);
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

  const toggleExpanded = (value: number, current: number[], setCurrent: (value: number[]) => void) => {
    setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <NavBar />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <section className="rounded-2xl border border-emerald-300/20 bg-gradient-to-r from-emerald-300/10 via-cyan-300/10 to-blue-300/10 p-4 shadow-2xl shadow-emerald-950/10">
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

        <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-5 shadow-2xl shadow-blue-950/20 md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
                Mission Control
              </p>
              <h1 className="mt-2 text-3xl font-semibold md:text-5xl">
                AI Command Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                The operating room for an autonomous business organization. The Executive AI
                turns founder intent into companies, departments, agents, approvals, and outputs.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="cyan">Founder intent first</Pill>
                <Pill tone="emerald">Headquarters view</Pill>
                <Pill tone="blue">Dry-run safe</Pill>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => setModalOpen(true)}
                  disabled={isDemoModeActive}
                  className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDemoModeActive ? 'Demo is read-only' : 'New idea'}
                </button>
                {isDemoModeActive ? (
                  <button
                    onClick={handleResetDemo}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                  >
                    Reset demo
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-4 lg:w-[360px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-cyan-100">Executive AI</p>
                  <p className="mt-1 text-xs text-cyan-100/75">Central intelligence online</p>
                </div>
                <span className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
                  Online
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <select
                  value={currentTenant}
                  onChange={(event) => switchTenant(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                >
                  {tenants.map((tenant) => (
                    <option key={tenant} value={tenant}>
                      {tenant}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreateTenant(true)}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                >
                  New
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Control panel</p>
                <div className="mt-3 space-y-3">
                  <ToggleRow
                    label="Compact activity feed"
                    description="Reduce the stream to denser mission updates."
                    checked={prefs.compactFeed}
                    onChange={() => setPrefs((current) => ({ ...current, compactFeed: !current.compactFeed }))}
                  />
                  <ToggleRow
                    label="Vision bridge"
                    description="Show the founder-vision to company mapping panel."
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
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:hidden">
          <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Mobile control</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <MiniMetric label="Companies" value={String(activeCompanies)} />
              <MiniMetric label="Approvals" value={String(pendingApprovals)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/headquarters" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">
                HQ
              </Link>
              <Link href="/harness-engineering" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">
                Harness
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('company');
                  setMobileDetailOpen(true);
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200"
              >
                Inspect
              </button>
              {isDemoModeActive ? (
                <button onClick={handleResetDemo} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">
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
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
              >
                Inspect
              </button>
              <button
                type="button"
                onClick={copyShareableView}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
              >
                Copy link
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
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
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
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
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
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
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
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
                >
                  <p className="text-sm font-semibold text-white">Output</p>
                  <p className="mt-1 text-xs text-slate-400">See produced artifacts</p>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setModalOpen(true)}
                  disabled={isDemoModeActive}
                  className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDemoModeActive ? 'Demo locked' : 'New idea'}
                </button>
                {isDemoModeActive ? (
                  <button
                    onClick={handleResetDemo}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200"
                  >
                    Reset demo
                  </button>
                ) : (
                  <Link href="/security" className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200">
                    War room
                  </Link>
                )}
              </div>
              {selectedExecutionRun ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Mission Composer
                </p>
                <h2 className="mt-2 text-2xl font-semibold">State a business objective once</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                  The founder should describe the business outcome, not individual agents. The
                  Executive AI expands that objective into companies, departments, teams, agents,
                  tasks, connectors, and outputs.
                </p>
              </div>
              <Pill tone="emerald">Founder intent first</Pill>
            </div>

            <textarea
              className="mt-5 min-h-40 w-full rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
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
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/[0.06]"
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
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
              >
                Review mission
              </button>
              <button
                onClick={() => submitMission(missionDraft)}
                disabled={submitting || !missionDraft.trim() || isDemoModeActive}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDemoModeActive ? 'Demo is read-only' : submitting ? 'Starting...' : 'Launch mission'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Mission growth preview
                </p>
                <h2 className="mt-2 text-2xl font-semibold">The next objective grows the org</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  This preview is derived from the founder’s draft so the hierarchy shows the
                  shape of the business before the mission is launched.
                </p>
              </div>
              <Pill tone="amber">{missionBlueprint.companyName}</Pill>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <p className="text-sm text-slate-400">Planned company</p>
                    <h3 className="text-lg font-semibold text-white">{missionBlueprint.companyName}</h3>
                    <p className="mt-1 text-sm text-slate-400">{missionBlueprint.description}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    objective-linked
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {missionBlueprint.departments.map((department) => (
                    <div key={department.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-cyan-100">{department.name}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{department.description}</p>
                        </div>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300">
                          {department.teams.length} teams
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {department.teams.map((team) => (
                          <div key={team.name} className="rounded-lg border border-white/10 bg-slate-950/80 p-3">
                            <p className="text-sm text-white">{team.name}</p>
                            <p className="mt-1 text-xs text-slate-400">{team.description}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {team.agents.map((agent) => (
                                <span
                                  key={agent.name}
                                  className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] text-cyan-100"
                                >
                                  {agent.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <DetailPanel
                  title="Connectors"
                  subtitle="Interfaces this objective needs"
                  items={missionBlueprint.connectors}
                  emptyLabel="No connector inference yet"
                />
                <DetailPanel
                  title="Tasks"
                  subtitle="Live work queue"
                  items={(activeCompanyDetail?.tasks || []).slice(0, 5).map((task) => `${task.title} · ${task.workflow_stage}`)}
                  emptyLabel={companyLoading ? 'Loading company tasks...' : 'No tasks in this company yet'}
                />
                <DetailPanel
                  title="Outputs"
                  subtitle="Artifacts and deliverables"
                  items={(activeCompanyDetail?.outputs || []).slice(0, 5).map((output) => `${output.title} · ${output.status}`)}
                  emptyLabel={companyLoading ? 'Loading outputs...' : 'No outputs in this company yet'}
                />
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
          <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Vision bridge
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Turn founder intent into an operating system</h2>
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

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_420px]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Live hierarchy
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Headquarters rendered from actual data</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Companies expand into departments, departments contain teams, and teams hold the
                  agents. Click any layer to drill down.
                </p>
              </div>
              <Pill tone="cyan">{headquarters?.executive_ai?.status || 'online'}</Pill>
            </div>

            {headquarters?.companies?.length ? (
              <div className="mt-5 space-y-4">
                {headquarters.companies.map((company) => {
                  const companyOpen = expandedCompanies.includes(company.id);
                  return (
                    <div
                      key={company.id}
                      className={`rounded-2xl border p-4 transition ${
                        selectedCompanyId === company.id
                          ? 'border-cyan-300/40 bg-cyan-300/10'
                          : 'border-white/10 bg-black/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCompanyId(company.id);
                          toggleExpanded(company.id, expandedCompanies, setExpandedCompanies);
                        }}
                        className="flex w-full items-start justify-between gap-4 text-left"
                      >
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
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <CountPill value={`${company.departments?.length || 0} departments`} />
                          <CountPill value={`${countTeams(company.departments)} teams`} />
                          <CountPill value={`${countAgents(company.departments)} agents`} />
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                            {companyOpen ? 'Collapse' : 'Expand'}
                          </span>
                        </div>
                      </button>

                      {companyOpen && (
                        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                          {company.departments?.length ? (
                            company.departments.map((department) => {
                              const departmentOpen = expandedDepartments.includes(department.id);
                              return (
                                <div key={department.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDepartmentId(department.id);
                                      toggleExpanded(department.id, expandedDepartments, setExpandedDepartments);
                                    }}
                                    className="flex w-full items-center justify-between gap-4 text-left"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-cyan-100">{department.name}</p>
                                      <p className="mt-1 text-xs leading-5 text-slate-400">{department.description}</p>
                                    </div>
                                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                                      {departmentOpen ? 'Collapse' : 'Expand'} · {department.teams?.length || 0} teams
                                    </span>
                                  </button>

                                  {departmentOpen && (
                                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
                                      {department.teams?.map((team) => {
                                        const teamOpen = expandedTeams.includes(team.id);
                                        return (
                                          <div key={team.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedTeamId(team.id);
                                                toggleExpanded(team.id, expandedTeams, setExpandedTeams);
                                              }}
                                              className="flex w-full items-start justify-between gap-4 text-left"
                                            >
                                              <div>
                                                <p className="text-sm font-medium text-white">{team.name}</p>
                                                <p className="mt-1 text-xs leading-5 text-slate-400">{team.description}</p>
                                              </div>
                                              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">
                                                {teamOpen ? 'Collapse' : 'Expand'} · {team.agents?.length || 0}
                                              </span>
                                            </button>

                                            {teamOpen && (
                                              <div className="mt-3 flex flex-wrap gap-2">
                                                {team.agents?.length ? (
                                                  team.agents.map((agent) => {
                                                    const agentOpen = expandedAgents.includes(agent.id);
                                                    return (
                                                      <button
                                                        key={agent.id}
                                                        type="button"
                                                        onClick={() => {
                                                          setSelectedAgentId(agent.id);
                                                          toggleExpanded(agent.id, expandedAgents, setExpandedAgents);
                                                        }}
                                                        className={`rounded-full border px-3 py-1 text-xs transition ${
                                                          selectedAgentId === agent.id
                                                            ? 'border-emerald-300/30 bg-emerald-300/20 text-emerald-100'
                                                            : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-300/30'
                                                        }`}
                                                      >
                                                        {agent.agent_name}
                                                        <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                                          {agentOpen ? 'open' : agent.task_type || 'agent'}
                                                        </span>
                                                      </button>
                                                    );
                                                  })
                                                ) : (
                                                  <span className="text-xs text-slate-500">No agents assigned.</span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                              No departments yet.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-slate-400">
                No headquarters data yet.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Operations console</h2>
                <p className="mt-1 text-sm text-slate-400">Selected company, connectors, tasks, and outputs</p>
              </div>
              {isStreaming && (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                  Streaming
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                      Current mission
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {loading ? 'Loading mission state...' : briefing?.objective || 'No active mission'}
                    </h3>
                  </div>
                  <StatusPill status={missionStatus} />
                </div>

                {briefing && briefing.agents.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {briefing.agents.map((agent, index) => (
                      <div
                        key={`${agent.name}-${index}`}
                        className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">{agent.name}</p>
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">
                            assigned
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{agent.task}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/80 p-4 text-sm leading-6 text-slate-400">
                    No active agent team is deployed. Start with a business objective and the Executive AI will create the plan.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                  <button
                    onClick={() => handleApprove('decree')}
                    disabled={!briefing || briefing.status === 'approved' || submitting}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Decree mission
                  </button>
                  <button
                    onClick={() => handleApprove('abandon')}
                    disabled={!briefing || briefing.status === 'abandoned' || submitting}
                    className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Abandon
                  </button>
                  <a href="/api/briefing" className="text-sm text-cyan-200 underline-offset-4 hover:underline">
                    Raw briefing
                  </a>
                </div>
              </div>

              <DetailPanel
                title="Selected node"
                subtitle="Where you are in the org"
                items={selectedNodeTrail}
                emptyLabel="Select a company, department, team, or agent"
              />
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">{activeCompanyDetail?.name || 'No company selected'}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {activeCompanyDetail?.description || 'Choose a live company in Headquarters to inspect its tasks and outputs.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="cyan">{activeCompanyDetail?.departments?.length || 0} departments</Pill>
                  <Pill tone="emerald">{activeConnectors.length} connectors</Pill>
                  <Pill tone="blue">{activeTasksList.length} tasks</Pill>
                  <Pill tone="amber">{activeOutputsList.length} outputs</Pill>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/headquarters${selectedCompanyId ? `?company=${selectedCompanyId}` : ''}`}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/5"
                  >
                    Open HQ view
                  </Link>
                  <button
                    type="button"
                    onClick={copyShareableView}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/5"
                  >
                    Copy current link
                  </button>
                </div>
              </div>
              <ControlSurfaceSection
                title="Connectors"
                subtitle="Live system links"
                items={activeConnectors}
                selectedId={selectedConnectorId}
                emptyLabel={companyLoading ? 'Loading connectors...' : 'No connectors yet'}
                renderLabel={(connector) => connector.name}
                renderMeta={(connector) => `${connector.connector_type} · ${connector.status}`}
                onSelect={(connector) => setSelectedConnectorId(connector.id)}
                detail={
                  selectedConnector
                    ? {
                        label: selectedConnector.name,
                        description: selectedConnector.summary || 'No connector summary.',
                        badges: [selectedConnector.connector_type, selectedConnector.status],
                      }
                    : null
                }
              />
              <ControlSurfaceSection
                title="Tasks"
                subtitle="Live work queue"
                items={activeTasksList.slice(0, prefs.compactFeed ? 3 : 6)}
                selectedId={selectedTaskId}
                emptyLabel={companyLoading ? 'Loading tasks...' : 'No tasks yet'}
                renderLabel={(task) => task.title}
                renderMeta={(task) => `${task.workflow_stage} · ${task.priority} · ${task.status}`}
                onSelect={(task) => setSelectedTaskId(task.id)}
                detail={
                  selectedTask
                    ? {
                        label: selectedTask.title,
                        description: selectedTask.description || 'No task description.',
                        badges: [selectedTask.workflow_stage, selectedTask.status],
                      }
                    : null
                }
              />
              <ControlSurfaceSection
                title="Outputs"
                subtitle="Artifacts produced by the company"
                items={activeOutputsList.slice(0, prefs.compactFeed ? 3 : 6)}
                selectedId={selectedOutputId}
                emptyLabel={companyLoading ? 'Loading outputs...' : 'No outputs yet'}
                renderLabel={(output) => output.title}
                renderMeta={(output) => `${output.output_type} · ${output.status}`}
                onSelect={(output) => setSelectedOutputId(output.id)}
                detail={
                  selectedOutput
                    ? {
                        label: selectedOutput.title,
                        description: selectedOutput.summary || 'No output summary.',
                        badges: [selectedOutput.output_type, selectedOutput.status],
                      }
                    : null
                }
              />
              <DetailPanel
                title="Mission preview"
                subtitle="Objective-linked growth"
                items={missionBlueprint.connectors}
                emptyLabel="No connectors inferred"
              />
              <div className="max-h-[240px] space-y-3 overflow-y-auto pr-1">
                {logs.length > 0 ? (
                  logs.slice(prefs.compactFeed ? -6 : -12).map((log, index) => (
                    <ActivityRow key={`${log}-${index}`} title={log} meta="Mission stream" tone="cyan" />
                  ))
                ) : (
                  operations.map((item) => (
                    <ActivityRow key={item.title} title={item.title} meta={item.meta} tone={item.tone} />
                  ))
                )}
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

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Harness Engineering queue</h2>
                <p className="mt-1 text-sm text-slate-400">Factory-building requests and approval state</p>
              </div>
              <Link href="/harness-engineering" className="text-sm text-cyan-200 underline-offset-4 hover:underline">
                Manage
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {selfCodingRequests.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                  No Harness Engineering requests yet.
                </p>
              ) : (
                selfCodingRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="max-w-xl text-sm font-medium text-white">{request.request}</p>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
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

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
            <h2 className="text-lg font-semibold">Analytics snapshot</h2>
            <p className="mt-1 text-sm text-slate-400">Agent and platform performance</p>
            <button
              onClick={handleAnalytics}
              className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.06]"
            >
              Open current analytics report
            </button>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="API cost" value="$0.00" />
              <MiniMetric label="Health" value="Nominal" />
              <MiniMetric label="Runtime" value="2.3s" />
              <MiniMetric label="Failures" value="0" />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Execution control
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Approved run history</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                This is the execution record tied to approved harness plans. It shows the exact plan
                snapshot, runtime mode, and rollback posture used for each run.
              </p>
            </div>
            <Pill tone="cyan">
              {executionRuns.length} run{executionRuns.length === 1 ? '' : 's'}
            </Pill>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Run detail</p>
                  <p className="mt-1 text-xs text-slate-400">Inspect one approved execution at a time</p>
                </div>
                {selectedExecutionRun ? (
                  <div className="flex flex-wrap gap-2">
                    <ExecutionBadge status={selectedExecutionRun.status} />
                    <button
                      onClick={() => handleRollbackRun(selectedExecutionRun)}
                      disabled={selectedExecutionRun.status === 'rolled_back'}
                      className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Rollback
                    </button>
                  </div>
                ) : null}
              </div>

              {selectedExecutionRun ? (
                <div className="mt-4 space-y-3">
                  <ExecutionMetric label="Goal" value={selectedExecutionRun.goal} />
                  <ExecutionMetric label="Run mode" value={selectedExecutionRun.runtime_mode} />
                  <ExecutionMetric label="Status" value={selectedExecutionRun.status} />
                  <ExecutionMetric label="Rollback" value={selectedExecutionRun.rollback_state} />
                  <ExecutionMetric
                    label="Plan ceiling"
                    value={`${selectedExecutionRun.runtime_plan.token_cost_ceiling.tokens} tokens · ${selectedExecutionRun.runtime_plan.token_cost_ceiling.cost_usd}`}
                  />
                  <ExecutionMetric
                    label="Approval lock"
                    value={`${selectedExecutionRun.paid_ai ? 'Paid AI on' : 'Paid AI off'} · ${selectedExecutionRun.mock_mode ? 'mock-safe' : 'live'}`}
                  />
                  {selectedRuntimePlan ? (
                    <div className="rounded-xl border border-white/10 bg-slate-950/80 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Approved runtime plan</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Exact plan used by execution. This is the founder-visible harness contract.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={copySelectedRunPlan}
                          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.06]"
                        >
                          Copy plan
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <RuntimePlanBlock label="Sandbox scope" values={selectedRuntimePlan.sandbox_scope} />
                        <RuntimePlanBlock label="Permissions" values={selectedRuntimePlan.permissions} />
                        <RuntimePlanBlock label="Validation checks" values={selectedRuntimePlan.validation_checks} />
                        <RuntimePlanBlock label="Rollback path" values={selectedRuntimePlan.rollback_path} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MiniMetric label="Token ceiling" value={`${selectedRuntimePlan.token_cost_ceiling.tokens}`} />
                        <MiniMetric label="Cost ceiling" value={selectedRuntimePlan.token_cost_ceiling.cost_usd} />
                      </div>
                      {selectedRuntimePlan.runtime_notes.length ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Runtime notes</p>
                          <div className="mt-2 space-y-2">
                            {selectedRuntimePlan.runtime_notes.map((note) => (
                              <p key={note} className="text-sm leading-6 text-slate-200">
                                {note}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/80 p-4 text-sm text-slate-500">
                  No approved execution has started yet.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Recent runs</p>
              <p className="mt-1 text-xs text-slate-400">Execution timeline and rollback state</p>

              <div className="mt-4 space-y-3">
                {executionRuns.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 bg-slate-950/80 p-4 text-sm text-slate-500">
                    No execution records yet.
                  </p>
                ) : (
                  executionRuns.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => setSelectedExecutionRunId(run.id)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selectedExecutionRun?.id === run.id
                          ? 'border-cyan-300/50 bg-cyan-300/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/30 hover:bg-white/[0.06]'
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
          </div>
        </section>
      </main>

      {modalOpen && (
        <Modal title="New Mission" onClose={() => { setModalOpen(false); setGoal(''); }}>
          <p className="text-sm text-slate-400">
            Describe the business outcome. The Executive AI will decompose it into company,
            department, agent, and approval work.
          </p>
          <textarea
            className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm leading-6 text-white outline-none focus:border-cyan-300/60"
            rows={4}
            placeholder="Example: I want to build a YouTube business around AI education."
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => { setModalOpen(false); setGoal(''); }}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleNewMission}
              disabled={submitting || !goal.trim() || isDemoModeActive}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDemoModeActive ? 'Demo is read-only' : submitting ? 'Deploying...' : 'Decree mission'}
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
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm text-white outline-none focus:border-cyan-300/60"
          />
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => { setShowCreateTenant(false); setNewTenantName(''); }}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={createTenant}
              disabled={isDemoModeActive}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDemoModeActive ? 'Demo is read-only' : 'Create'}
            </button>
          </div>
        </Modal>
      )}

      {mobileDetailOpen && mobileDetail ? (
        <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
          <div className="mx-auto max-w-2xl rounded-t-3xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl shadow-black/60 backdrop-blur">
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
                className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-200"
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
                className={`rounded-xl border px-3 py-2 text-sm ${mobileDetailKind === 'company' ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-200'}`}
              >
                Company
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('connector');
                  setMobileDetailOpen(true);
                }}
                className={`rounded-xl border px-3 py-2 text-sm ${mobileDetailKind === 'connector' ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-200'}`}
              >
                Connector
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('task');
                  setMobileDetailOpen(true);
                }}
                className={`rounded-xl border px-3 py-2 text-sm ${mobileDetailKind === 'task' ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-200'}`}
              >
                Task
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailKind('output');
                  setMobileDetailOpen(true);
                }}
                className={`rounded-xl border px-3 py-2 text-sm ${mobileDetailKind === 'output' ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-200'}`}
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
      className={`rounded-2xl border p-5 ${
        tone === 'cyan'
          ? 'border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-slate-950 to-slate-950'
          : tone === 'emerald'
            ? 'border-emerald-300/15 bg-gradient-to-br from-emerald-300/10 via-slate-950 to-slate-950'
            : tone === 'blue'
              ? 'border-blue-300/15 bg-gradient-to-br from-blue-300/10 via-slate-950 to-slate-950'
              : 'border-amber-300/15 bg-gradient-to-br from-amber-300/10 via-slate-950 to-slate-950'
      }`}
    >
      <p className={`text-3xl font-semibold ${tones[tone]}`}>{value}</p>
      <p className="mt-2 text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isReady = status === 'Approved' || status === 'No active mission';
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        isReady
          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
          : 'border-amber-300/20 bg-amber-300/10 text-amber-200'
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
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4">
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
      <Link href={href} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 transition hover:border-cyan-300/40 hover:bg-slate-900/80">
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-5 text-left transition hover:border-cyan-300/40 hover:shadow-lg hover:shadow-cyan-950/20"
    >
      {content}
    </button>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
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
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/40">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/5">
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

  return <span className={`rounded-full border px-3 py-1 text-xs ${styles[tone]}`}>{children}</span>;
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
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-cyan-300/30 hover:bg-white/[0.04]"
    >
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <span
        className={`relative h-6 w-11 rounded-full border transition ${
          checked ? 'border-emerald-300/30 bg-emerald-300/20' : 'border-white/10 bg-white/5'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function BridgeCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4">
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
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {items.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div key={item} className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-200">
              {item}
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-slate-500">
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
}

function ExecutionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/80 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-white">{value}</p>
    </div>
  );
}

function RuntimePlanBlock({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span key={value} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-200">
            {value}
          </span>
        ))}
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

function ControlSurfaceSection({
  title,
  subtitle,
  items,
  selectedId,
  emptyLabel,
  renderLabel,
  renderMeta,
  onSelect,
  detail,
}: {
  title: string;
  subtitle: string;
  items: any[];
  selectedId: number | null;
  emptyLabel: string;
  renderLabel: (item: any) => string;
  renderMeta: (item: any) => string;
  onSelect: (item: any) => void;
  detail: { label: string; description: string; badges: string[] } | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {items.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => {
            const key = item.id ?? renderLabel(item);
            const active = selectedId === item.id;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                  active ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-white/10 bg-slate-950/80 hover:border-cyan-300/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white">{renderLabel(item)}</p>
                    <p className="mt-1 text-xs text-slate-400">{renderMeta(item)}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {active ? 'selected' : 'view'}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-slate-500">
            {emptyLabel}
          </p>
        )}
      </div>

      {detail && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/80 p-4">
          <p className="text-sm font-semibold text-white">{detail.label}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{detail.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.badges.map((badge) => (
              <span key={badge} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300">
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CountPill({ value }: { value: string }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">{value}</span>;
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
