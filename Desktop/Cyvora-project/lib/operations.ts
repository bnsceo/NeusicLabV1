import {
  getAgentAssignments,
  getAllMissions,
  getCompanies,
  getConnectorActionRuns,
  getConnectors,
  getDepartments,
  getExecutionRuns,
  getOperationsIncidents,
  getPolicyDecisions,
  getRecoveryActions,
  getTeams,
  getTenantActivityEvents,
  getTenantApprovals,
  getTenantOutputs,
  getTenantTasks,
  getTenantUsageEvents,
  getTenantValidationRuns,
  getWorkerHeartbeats,
  requeueTask,
  resolveInactiveOperationsIncidents,
  retryExecutionRun,
  saveRecoveryAction,
  saveTenantActivityEvent,
  updateOperationsIncident,
  upsertOperationsIncident,
} from '@/lib/db';

export type OperationsSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

const WORKER_STALE_SECONDS = Number.parseInt(process.env.WORKER_STALE_SECONDS || '90', 10);

function safeDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageSeconds(value: unknown): number | null {
  const date = safeDate(value);
  return date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000)) : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function severityForRisk(value?: string): OperationsSeverity {
  if (value === 'critical') return 'critical';
  if (value === 'high') return 'high';
  if (value === 'medium') return 'medium';
  if (value === 'low') return 'low';
  return 'info';
}

function severityForAttempts(attempts: number, maxAttempts: number): OperationsSeverity {
  if (attempts >= maxAttempts && maxAttempts > 0) return 'critical';
  if (attempts >= Math.max(1, maxAttempts - 1)) return 'high';
  return 'medium';
}

function companyOperationalHealth(input: {
  blockedTasks: number;
  failedRuns: number;
  pendingApprovals: number;
  policyBlocks: number;
  staleAgents: number;
}) {
  const score = clamp(
    100 -
      input.blockedTasks * 12 -
      input.failedRuns * 14 -
      input.pendingApprovals * 3 -
      input.policyBlocks * 5 -
      input.staleAgents * 2,
    0,
    100
  );
  const status = score >= 90 ? 'healthy' : score >= 70 ? 'watch' : score >= 45 ? 'degraded' : 'critical';
  return { score, status };
}

export async function buildHeadquartersSnapshot(tenant: string) {
  const [companies, executionRuns, connectorActions, policyDecisions, workers, validations, tenantTasks, tenantApprovals, tenantOutputs] = await Promise.all([
    getCompanies(tenant),
    getExecutionRuns(tenant),
    getConnectorActionRuns(tenant, 100),
    getPolicyDecisions(tenant, 100),
    getWorkerHeartbeats(20),
    getTenantValidationRuns(tenant, 100),
    getTenantTasks(tenant, 300),
    getTenantApprovals(tenant, 300),
    getTenantOutputs(tenant, 300),
  ]);

  const organization = await Promise.all(
    companies.map(async (company: any) => {
      const [departments, connectors] = await Promise.all([
        getDepartments(company.id),
        getConnectors(company.id),
      ]);
      const nestedDepartments = await Promise.all(
        departments.map(async (department: any) => {
          const teams = await getTeams(department.id);
          const nestedTeams = await Promise.all(
            teams.map(async (team: any) => ({ ...team, agents: await getAgentAssignments(team.id) }))
          );
          return { ...department, teams: nestedTeams };
        })
      );

      const tasks = tenantTasks.filter((task: any) => task.company_id === company.id);
      const approvals = tenantApprovals.filter((approval: any) => approval.company_id === company.id);
      const outputs = tenantOutputs.filter((output: any) => output.company_id === company.id);
      const runs = executionRuns.filter((run: any) => run.company_id === company.id);
      const actions = connectorActions.filter((action: any) => action.company_id === company.id);
      const policies = policyDecisions.filter((decision: any) => decision.company_id === company.id);
      const companyValidations = validations.filter((validation: any) => validation.company_id === company.id);
      const agentCount = nestedDepartments.reduce(
        (count: number, department: any) => count + department.teams.reduce((sum: number, team: any) => sum + team.agents.length, 0),
        0
      );
      const blockedTasks = tasks.filter((task: any) => ['blocked', 'failed', 'error'].includes(task.status)).length;
      const failedRuns = runs.filter((run: any) => ['blocked', 'failed', 'error'].includes(run.status)).length;
      const pendingApprovals = approvals.filter((approval: any) => approval.status === 'pending').length;
      const policyBlocks = policies.filter((decision: any) => decision.effect === 'block').length;
      const health = companyOperationalHealth({ blockedTasks, failedRuns, pendingApprovals, policyBlocks, staleAgents: 0 });

      return {
        ...company,
        departments: nestedDepartments,
        connectors,
        operational_summary: {
          health,
          agents: agentCount,
          tasks_total: tasks.length,
          tasks_active: tasks.filter((task: any) => ['active', 'in_progress'].includes(task.status)).length,
          tasks_blocked: blockedTasks,
          approvals_pending: pendingApprovals,
          outputs_candidate: outputs.filter((output: any) => output.status !== 'final').length,
          runs_active: runs.filter((run: any) => ['queued', 'in_progress'].includes(run.status)).length,
          runs_failed: failedRuns,
          connectors_enabled: connectors.filter((connector: any) => connector.status === 'enabled' || connector.status === 'active').length,
          connector_actions: actions.length,
          policy_blocks: policyBlocks,
          validations_failed: companyValidations.filter((validation: any) => ['failed', 'blocked', 'rejected'].includes(validation.status)).length,
        },
      };
    })
  );

  const latestWorker = workers[0] || null;
  const workerAge = latestWorker ? ageSeconds(latestWorker.last_seen_at) : null;
  const workerStatus = latestWorker
    ? workerAge !== null && workerAge <= WORKER_STALE_SECONDS
      ? 'online'
      : 'stale'
    : 'unknown';
  const queue = {
    queued_runs: executionRuns.filter((run: any) => run.status === 'queued').length,
    in_progress_runs: executionRuns.filter((run: any) => run.status === 'in_progress').length,
    failed_runs: executionRuns.filter((run: any) => ['blocked', 'failed', 'error'].includes(run.status)).length,
    active_tasks: tenantTasks.filter((task: any) => task.status === 'active').length,
    in_progress_tasks: tenantTasks.filter((task: any) => task.status === 'in_progress').length,
    blocked_tasks: tenantTasks.filter((task: any) => ['blocked', 'failed', 'error'].includes(task.status)).length,
    pending_approvals: tenantApprovals.filter((approval: any) => approval.status === 'pending').length,
  };

  const totals = organization.reduce(
    (acc: any, company: any) => {
      acc.companies += 1;
      acc.departments += company.departments.length;
      acc.teams += company.departments.reduce((sum: number, department: any) => sum + department.teams.length, 0);
      acc.agents += company.operational_summary.agents;
      acc.connectors += company.connectors.length;
      return acc;
    },
    {
      companies: 0,
      departments: 0,
      teams: 0,
      agents: 0,
      connectors: 0,
      tasks: tenantTasks.length,
      approvals: tenantApprovals.filter((approval: any) => approval.status === 'pending').length,
      outputs: tenantOutputs.length,
    }
  );

  return {
    tenant,
    generated_at: new Date().toISOString(),
    executive_ai: {
      name: 'Executive AI',
      role: 'Autonomous CEO and operating intelligence',
      status: workerStatus === 'online' ? 'online' : 'degraded',
    },
    totals,
    runtime: {
      status: workerStatus === 'online' && queue.failed_runs === 0 ? 'healthy' : workerStatus === 'unknown' ? 'unknown' : 'degraded',
      worker_status: workerStatus,
      worker_age_seconds: workerAge,
      latest_worker: latestWorker,
      workers,
      queue,
    },
    companies: organization,
    live_operations: {
      execution_runs: executionRuns.slice(0, 25),
      tasks: tenantTasks.slice(0, 40),
      approvals: tenantApprovals.filter((approval: any) => approval.status === 'pending').slice(0, 25),
      outputs: tenantOutputs.slice(0, 25),
      connector_actions: connectorActions.slice(0, 25),
      policy_decisions: policyDecisions.slice(0, 25),
      validations: validations.slice(0, 25),
    },
    activity: await getTenantActivityEvents(tenant, 40),
  };
}

type DerivedIncident = {
  fingerprint: string;
  company_id?: number;
  source_type: string;
  source_id?: string | number;
  severity: OperationsSeverity;
  title: string;
  description: string;
  remediation: string;
  target_type?: string;
  target_id?: number;
  metadata?: Record<string, unknown>;
};

async function syncDerivedIncidents(tenant: string) {
  const [workers, runs, tasks, validations, connectorActions, policyDecisions] = await Promise.all([
    getWorkerHeartbeats(20),
    getExecutionRuns(tenant),
    getTenantTasks(tenant, 300),
    getTenantValidationRuns(tenant, 200),
    getConnectorActionRuns(tenant, 200),
    getPolicyDecisions(tenant, 200),
  ]);

  const derived: DerivedIncident[] = [];
  const latestWorker = workers[0] || null;
  const latestWorkerAge = latestWorker ? ageSeconds(latestWorker.last_seen_at) : null;
  if (!latestWorker) {
    derived.push({
      fingerprint: 'worker:none',
      source_type: 'worker',
      severity: 'high',
      title: 'No worker heartbeat detected',
      description: 'Cyvora cannot confirm that an execution worker is running.',
      remediation: 'Start the worker process and verify the shared database path.',
      metadata: { stale_after_seconds: WORKER_STALE_SECONDS },
    });
  } else if (latestWorkerAge !== null && latestWorkerAge > WORKER_STALE_SECONDS) {
    derived.push({
      fingerprint: `worker:stale:${latestWorker.worker_id}`,
      source_type: 'worker',
      source_id: latestWorker.worker_id,
      severity: latestWorkerAge > WORKER_STALE_SECONDS * 4 ? 'critical' : 'high',
      title: `Worker ${latestWorker.worker_id} is stale`,
      description: `The latest heartbeat is ${latestWorkerAge} seconds old.`,
      remediation: 'Restart the worker and inspect the worker loop or database connection.',
      metadata: { age_seconds: latestWorkerAge, worker: latestWorker },
    });
  }

  for (const run of runs.filter((item: any) => ['blocked', 'failed', 'error'].includes(item.status))) {
    derived.push({
      fingerprint: `execution-run:${run.id}:${run.status}:${run.attempt_count || 0}`,
      company_id: run.company_id || undefined,
      source_type: 'execution_run',
      source_id: run.id,
      severity: severityForAttempts(Number(run.attempt_count || 0), Number(run.max_attempts || 3)),
      title: `Execution run #${run.id} is ${run.status}`,
      description: run.error_message || `The run for “${run.goal}” stopped before completion.`,
      remediation: 'Review the approved runtime plan, then retry the run after correcting the root cause.',
      target_type: 'execution_run',
      target_id: run.id,
      metadata: { status: run.status, attempts: run.attempt_count, max_attempts: run.max_attempts, goal: run.goal },
    });
  }

  for (const task of tasks.filter((item: any) => ['blocked', 'failed', 'error'].includes(item.status))) {
    derived.push({
      fingerprint: `task:${task.id}:${task.status}:${task.attempt_count || 0}`,
      company_id: task.company_id || undefined,
      source_type: 'task',
      source_id: task.id,
      severity: severityForAttempts(Number(task.attempt_count || 0), Number(task.max_attempts || 3)),
      title: `Task #${task.id} is ${task.status}`,
      description: task.last_error || `“${task.title}” cannot continue in its current state.`,
      remediation: 'Inspect the assigned agent, approval, and validation policy, then requeue the task.',
      target_type: 'task',
      target_id: task.id,
      metadata: { status: task.status, risk_level: task.risk_level, task_title: task.title, company_name: task.company_name },
    });
  }

  for (const validation of validations.filter((item: any) => ['failed', 'blocked', 'rejected'].includes(item.status) || item.blocking_findings?.length > 0)) {
    derived.push({
      fingerprint: `validation:${validation.id}:${validation.status}`,
      company_id: validation.company_id || undefined,
      source_type: 'validation',
      source_id: validation.id,
      severity: validation.blocking_findings?.length > 0 ? 'high' : 'medium',
      title: `Validation #${validation.id} did not pass`,
      description: validation.decision || `${validation.blocking_findings?.length || 0} blocking findings were recorded.`,
      remediation: 'Review the candidate output and blocking findings before approving another execution attempt.',
      target_type: 'task',
      target_id: validation.task_id,
      metadata: { findings: validation.findings, blocking_findings: validation.blocking_findings, task_title: validation.task_title },
    });
  }

  for (const action of connectorActions.filter((item: any) => ['failed', 'blocked', 'error'].includes(item.status))) {
    derived.push({
      fingerprint: `connector-action:${action.id}:${action.status}`,
      company_id: action.company_id || undefined,
      source_type: 'connector_action',
      source_id: action.id,
      severity: severityForRisk(action.risk_level),
      title: `${action.connector_id}.${action.action_id} was ${action.status}`,
      description: action.result?.message || `The ${action.mode} connector action did not complete.`,
      remediation: 'Inspect the policy decision, payload, and connector installation before simulating the action again.',
      metadata: { connector_id: action.connector_id, action_id: action.action_id, policy_effect: action.policy_effect },
    });
  }

  for (const decision of policyDecisions.filter((item: any) => item.effect === 'block')) {
    derived.push({
      fingerprint: `policy-block:${decision.id}`,
      company_id: decision.company_id || undefined,
      source_type: 'policy',
      source_id: decision.id,
      severity: severityForRisk(decision.risk_level),
      title: `Policy blocked a ${decision.side_effect || 'governed'} action`,
      description: decision.reason,
      remediation: 'Change the action, lower its risk, or use an allowed founder approval path. Do not bypass policy controls.',
      metadata: { policy_pack: decision.policy_pack, matched_rules: decision.matched_rules },
    });
  }

  const activeFingerprints = derived.map((incident) => incident.fingerprint);
  await Promise.all(derived.map((incident) => upsertOperationsIncident({ tenant, ...incident })));
  await resolveInactiveOperationsIncidents(tenant, activeFingerprints);

  return { workers, runs, tasks, validations, connectorActions, policyDecisions };
}

export async function buildWarRoomSnapshot(tenant: string) {
  const synced = await syncDerivedIncidents(tenant);
  const [incidents, recoveryActions] = await Promise.all([
    getOperationsIncidents(tenant, 300),
    getRecoveryActions(tenant, 150),
  ]);
  const openIncidents = incidents.filter((incident: any) => incident.status !== 'resolved');
  const latestWorker = synced.workers[0] || null;
  const workerAge = latestWorker ? ageSeconds(latestWorker.last_seen_at) : null;
  const queue = {
    queued_runs: synced.runs.filter((run: any) => run.status === 'queued').length,
    in_progress_runs: synced.runs.filter((run: any) => run.status === 'in_progress').length,
    blocked_runs: synced.runs.filter((run: any) => ['blocked', 'failed', 'error'].includes(run.status)).length,
    active_tasks: synced.tasks.filter((task: any) => task.status === 'active').length,
    in_progress_tasks: synced.tasks.filter((task: any) => task.status === 'in_progress').length,
    blocked_tasks: synced.tasks.filter((task: any) => ['blocked', 'failed', 'error'].includes(task.status)).length,
  };

  return {
    tenant,
    generated_at: new Date().toISOString(),
    posture: {
      status: openIncidents.some((incident: any) => incident.severity === 'critical')
        ? 'critical'
        : openIncidents.some((incident: any) => incident.severity === 'high')
          ? 'degraded'
          : openIncidents.length > 0
            ? 'watch'
            : 'healthy',
      open_incidents: openIncidents.length,
      critical_incidents: openIncidents.filter((incident: any) => incident.severity === 'critical').length,
      high_incidents: openIncidents.filter((incident: any) => incident.severity === 'high').length,
      resolved_incidents: incidents.filter((incident: any) => incident.status === 'resolved').length,
    },
    runtime: {
      latest_worker: latestWorker,
      worker_age_seconds: workerAge,
      worker_status: !latestWorker ? 'unknown' : workerAge !== null && workerAge <= WORKER_STALE_SECONDS ? 'online' : 'stale',
      workers: synced.workers,
      queue,
    },
    incidents,
    failed_runs: synced.runs.filter((run: any) => ['blocked', 'failed', 'error'].includes(run.status)).slice(0, 50),
    blocked_tasks: synced.tasks.filter((task: any) => ['blocked', 'failed', 'error'].includes(task.status)).slice(0, 50),
    validation_failures: synced.validations.filter((validation: any) => ['failed', 'blocked', 'rejected'].includes(validation.status) || validation.blocking_findings?.length > 0).slice(0, 50),
    connector_failures: synced.connectorActions.filter((action: any) => ['failed', 'blocked', 'error'].includes(action.status)).slice(0, 50),
    policy_blocks: synced.policyDecisions.filter((decision: any) => decision.effect === 'block').slice(0, 50),
    recovery_actions: recoveryActions,
  };
}

export async function executeRecoveryAction(
  tenant: string,
  input: {
    action: 'acknowledge' | 'resolve' | 'retry_run' | 'requeue_task' | 'recheck';
    incident_id?: number;
    target_id?: number;
    requested_by?: string;
  }
) {
  if (input.action === 'recheck') return buildWarRoomSnapshot(tenant);
  if (!input.incident_id) throw new Error('incident_id is required');
  const incident = (await getOperationsIncidents(tenant, 500)).find((item: any) => item.id === input.incident_id);
  if (!incident) throw new Error('Incident not found');

  if (input.action === 'acknowledge' || input.action === 'resolve') {
    const status: IncidentStatus = input.action === 'acknowledge' ? 'acknowledged' : 'resolved';
    const changed = await updateOperationsIncident({ tenant, incident_id: input.incident_id, status });
    await saveRecoveryAction({
      tenant,
      company_id: incident.company_id || undefined,
      incident_id: incident.id,
      action_type: input.action,
      target_type: incident.target_type || undefined,
      target_id: incident.target_id || undefined,
      status: changed ? 'completed' : 'no_change',
      requested_by: input.requested_by || 'founder',
      result: changed ? `Incident ${status}.` : 'Incident was not changed.',
      completed: true,
    });
    await saveTenantActivityEvent({
      tenant,
      company_id: incident.company_id || undefined,
      event_type: `incident_${status}`,
      title: `${incident.title} ${status}`,
      description: `Founder action recorded in War Room for incident #${incident.id}.`,
    });
    return buildWarRoomSnapshot(tenant);
  }

  const targetId = input.target_id || incident.target_id;
  if (!targetId) throw new Error('target_id is required for recovery');

  const result = input.action === 'retry_run'
    ? await retryExecutionRun(tenant, targetId)
    : await requeueTask(tenant, targetId);
  const resultText = result.changed
    ? input.action === 'retry_run'
      ? `Execution run #${targetId} returned to the queue.`
      : `Task #${targetId} returned to the active queue.`
    : 'No eligible blocked target was changed.';

  await saveRecoveryAction({
    tenant,
    company_id: result.company_id || incident.company_id || undefined,
    incident_id: incident.id,
    action_type: input.action,
    target_type: input.action === 'retry_run' ? 'execution_run' : 'task',
    target_id: targetId,
    status: result.changed ? 'completed' : 'no_change',
    requested_by: input.requested_by || 'founder',
    result: resultText,
    completed: true,
  });
  await saveTenantActivityEvent({
    tenant,
    company_id: result.company_id || incident.company_id || undefined,
    event_type: input.action,
    title: resultText,
    description: `Recovery action was initiated from War Room incident #${incident.id}.`,
  });
  if (result.changed) {
    await updateOperationsIncident({ tenant, incident_id: incident.id, status: 'acknowledged' });
  }
  return buildWarRoomSnapshot(tenant);
}

export type HistoryFilter = {
  query?: string;
  category?: string;
  status?: string;
  companyId?: number;
  limit?: number;
};

export type UnifiedHistoryEvent = {
  id: string;
  category: string;
  source: string;
  source_id: string | number;
  title: string;
  description?: string;
  status?: string;
  severity: OperationsSeverity;
  company_id?: number;
  company_name?: string;
  actor?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

function inferSeverity(status?: string, risk?: string): OperationsSeverity {
  if (risk) return severityForRisk(risk);
  if (['failed', 'blocked', 'error', 'rejected', 'critical'].includes(status || '')) return 'high';
  if (['pending', 'queued', 'watch', 'acknowledged'].includes(status || '')) return 'medium';
  if (['completed', 'approved', 'final', 'resolved', 'healthy'].includes(status || '')) return 'info';
  return 'low';
}

export async function buildUnifiedHistory(tenant: string, filter: HistoryFilter = {}) {
  const [missions, activity, runs, tasks, approvals, outputs, validations, connectorActions, policies, usage, incidents, recoveries] = await Promise.all([
    getAllMissions(),
    getTenantActivityEvents(tenant, 500),
    getExecutionRuns(tenant),
    getTenantTasks(tenant, 500),
    getTenantApprovals(tenant, 500),
    getTenantOutputs(tenant, 500),
    getTenantValidationRuns(tenant, 500),
    getConnectorActionRuns(tenant, 500),
    getPolicyDecisions(tenant, 500),
    getTenantUsageEvents(tenant, 500),
    getOperationsIncidents(tenant, 500),
    getRecoveryActions(tenant, 500),
  ]);

  const events: UnifiedHistoryEvent[] = [];
  for (const item of missions) events.push({
    id: `mission:${item.id}`,
    category: 'mission', source: 'missions', source_id: item.id,
    title: item.objective, description: `Agents: ${item.agents || 'unassigned'}`,
    status: item.status, severity: inferSeverity(item.status), timestamp: item.timestamp,
    metadata: { briefing_file: item.briefing_file },
  });
  for (const item of activity) events.push({
    id: `activity:${item.id}`,
    category: 'activity', source: 'activity_events', source_id: item.id,
    title: item.title, description: item.description, status: item.event_type,
    severity: inferSeverity(item.event_type), company_id: item.company_id || undefined,
    company_name: item.company_name || undefined, timestamp: item.created_at,
    metadata: { event_type: item.event_type },
  });
  for (const item of runs) events.push({
    id: `execution:${item.id}`,
    category: 'execution', source: 'execution_runs', source_id: item.id,
    title: `Execution run #${item.id}: ${item.goal}`,
    description: item.error_message || `Runtime mode: ${item.runtime_mode}`,
    status: item.status, severity: inferSeverity(item.status), company_id: item.company_id || undefined,
    actor: item.claimed_by || 'runtime', timestamp: item.updated_at || item.started_at,
    metadata: { runtime_mode: item.runtime_mode, attempt_count: item.attempt_count, rollback_state: item.rollback_state },
  });
  for (const item of tasks) events.push({
    id: `task:${item.id}`,
    category: 'task', source: 'tasks', source_id: item.id,
    title: item.title, description: item.last_error || item.description,
    status: item.status, severity: inferSeverity(item.status, item.risk_level), company_id: item.company_id,
    company_name: item.company_name, actor: item.assigned_agent || undefined, timestamp: item.updated_at,
    metadata: { priority: item.priority, workflow_stage: item.workflow_stage, revision_count: item.revision_count },
  });
  for (const item of approvals) events.push({
    id: `approval:${item.id}`,
    category: 'approval', source: 'approvals', source_id: item.id,
    title: item.title, description: item.decision_reason || item.summary,
    status: item.status, severity: inferSeverity(item.status, item.risk_level), company_id: item.company_id,
    company_name: item.company_name, actor: item.status === 'pending' ? 'founder required' : 'founder', timestamp: item.updated_at,
    metadata: { approval_type: item.approval_type, subject_type: item.subject_type, subject_id: item.subject_id },
  });
  for (const item of outputs) events.push({
    id: `output:${item.id}`,
    category: 'output', source: 'outputs', source_id: item.id,
    title: item.title, description: item.summary,
    status: item.status, severity: inferSeverity(item.status), company_id: item.company_id,
    company_name: item.company_name, timestamp: item.finalized_at || item.created_at,
    metadata: { output_type: item.output_type, review_status: item.review_status, candidate_version: item.candidate_version },
  });
  for (const item of validations) events.push({
    id: `validation:${item.id}`,
    category: 'validation', source: 'validation_runs', source_id: item.id,
    title: `Validation for ${item.task_title || `task #${item.task_id}`}`,
    description: item.decision || `${item.blocking_findings?.length || 0} blocking findings`,
    status: item.status, severity: inferSeverity(item.status), company_id: item.company_id,
    company_name: item.company_name, actor: item.validator_type, timestamp: item.completed_at || item.started_at,
    metadata: { confidence: item.confidence, blocking_findings: item.blocking_findings, protocol: item.protocol },
  });
  for (const item of connectorActions) events.push({
    id: `connector:${item.id}`,
    category: 'connector', source: 'connector_action_runs', source_id: item.id,
    title: `${item.connector_id}.${item.action_id}`,
    description: item.external_reference || item.result?.message || `${item.mode} connector action`,
    status: item.status, severity: inferSeverity(item.status, item.risk_level), company_id: item.company_id || undefined,
    actor: item.requested_by, timestamp: item.completed_at || item.created_at,
    metadata: { mode: item.mode, policy_effect: item.policy_effect, reversible: item.reversible },
  });
  for (const item of policies) events.push({
    id: `policy:${item.id}`,
    category: 'policy', source: 'policy_decisions', source_id: item.id,
    title: `${item.policy_pack}: ${item.effect}`,
    description: item.reason, status: item.effect,
    severity: inferSeverity(item.effect, item.risk_level), company_id: item.company_id || undefined,
    actor: 'policy engine', timestamp: item.created_at,
    metadata: { side_effect: item.side_effect, matched_rules: item.matched_rules },
  });
  for (const item of usage) events.push({
    id: `usage:${item.id}`,
    category: 'usage', source: 'usage_events', source_id: item.id,
    title: `${item.provider}/${item.model} usage`,
    description: `${item.input_tokens} input and ${item.output_tokens} output tokens`,
    status: item.estimated_cost_usd > 0 ? 'billable' : 'zero-cost',
    severity: item.estimated_cost_usd > 0 ? 'medium' : 'info', company_id: item.company_id || undefined,
    company_name: item.company_name || undefined, actor: item.provider, timestamp: item.created_at,
    metadata: { estimated_cost_usd: item.estimated_cost_usd, execution_run_id: item.execution_run_id },
  });
  for (const item of incidents) events.push({
    id: `incident:${item.id}`,
    category: 'incident', source: 'operations_incidents', source_id: item.id,
    title: item.title, description: item.description, status: item.status,
    severity: severityForRisk(item.severity), company_id: item.company_id || undefined,
    company_name: item.company_name || undefined, actor: 'war room', timestamp: item.updated_at,
    metadata: { remediation: item.remediation, source_type: item.source_type, target_type: item.target_type, target_id: item.target_id },
  });
  for (const item of recoveries) events.push({
    id: `recovery:${item.id}`,
    category: 'recovery', source: 'recovery_actions', source_id: item.id,
    title: `${item.action_type.replaceAll('_', ' ')} ${item.status}`,
    description: item.result, status: item.status,
    severity: inferSeverity(item.status), company_id: item.company_id || undefined,
    company_name: item.company_name || undefined, actor: item.requested_by, timestamp: item.completed_at || item.created_at,
    metadata: { incident_id: item.incident_id, target_type: item.target_type, target_id: item.target_id },
  });

  const normalizedQuery = filter.query?.trim().toLowerCase() || '';
  const filtered = events
    .filter((event) => !normalizedQuery || `${event.title} ${event.description || ''} ${event.company_name || ''} ${event.status || ''}`.toLowerCase().includes(normalizedQuery))
    .filter((event) => !filter.category || filter.category === 'all' || event.category === filter.category)
    .filter((event) => !filter.status || filter.status === 'all' || event.status === filter.status)
    .filter((event) => !filter.companyId || event.company_id === filter.companyId)
    .sort((a, b) => (safeDate(b.timestamp)?.getTime() || 0) - (safeDate(a.timestamp)?.getTime() || 0));
  const limit = clamp(filter.limit || 200, 1, 500);
  const returned = filtered.slice(0, limit);
  const categories = [...new Set(events.map((event) => event.category))].sort();
  const statuses = [...new Set(events.map((event) => event.status).filter(Boolean) as string[])].sort();
  const companies = [...new Map(events.filter((event) => event.company_id).map((event) => [event.company_id, { id: event.company_id, name: event.company_name || `Company ${event.company_id}` }])).values()];

  return {
    tenant,
    generated_at: new Date().toISOString(),
    summary: {
      total_events: events.length,
      matched_events: filtered.length,
      returned_events: returned.length,
      open_incidents: incidents.filter((incident: any) => incident.status !== 'resolved').length,
      pending_approvals: approvals.filter((approval: any) => approval.status === 'pending').length,
      failed_executions: runs.filter((run: any) => ['blocked', 'failed', 'error'].includes(run.status)).length,
      estimated_cost_usd: usage.reduce((sum: number, item: any) => sum + Number(item.estimated_cost_usd || 0), 0),
    },
    filters: { categories, statuses, companies },
    events: returned,
  };
}
