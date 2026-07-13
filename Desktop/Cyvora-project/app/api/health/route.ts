import fs from 'fs';
import { NextResponse } from 'next/server';
import { getExecutionRuns, getTenantTasks, getWorkerHeartbeats } from '@/lib/db';
import { tenantsRoot } from '@/lib/paths';
import { getRuntimeModeInfo } from '@/lib/runtimeMode';
import { getTenantId } from '@/lib/tenant';

const WORKER_STALE_SECONDS = Number.parseInt(process.env.WORKER_STALE_SECONDS || '90', 10);
export const dynamic = 'force-dynamic';

export async function GET() {
  const checkedAt = new Date();
  const runtime = getRuntimeModeInfo();
  try {
    const tenant = await getTenantId();
    const [workers, runs, tasks] = await Promise.all([
      getWorkerHeartbeats(1),
      getExecutionRuns(tenant),
      getTenantTasks(tenant, 500),
    ]);
    const worker = workers[0] || null;
    const lastSeen = worker?.last_seen_at ? new Date(worker.last_seen_at) : null;
    const workerAgeSeconds = lastSeen ? Math.max(0, Math.floor((checkedAt.getTime() - lastSeen.getTime()) / 1000)) : null;
    const workerHealthy = workerAgeSeconds !== null && workerAgeSeconds <= WORKER_STALE_SECONDS;
    const tenantStorageReady = fs.existsSync(tenantsRoot) && fs.statSync(tenantsRoot).isDirectory();
    return NextResponse.json({
      status: workerHealthy && tenantStorageReady ? 'healthy' : 'degraded',
      checked_at: checkedAt.toISOString(),
      runtime: { mode: runtime.mode, mock_mode: runtime.mockMode, paid_ai_allowed: runtime.allowPaidAI },
      database: { status: 'ok' },
      worker: {
        status: workerHealthy ? 'online' : worker ? 'stale' : 'unknown',
        worker_id: worker?.worker_id || null,
        last_seen_at: worker?.last_seen_at || null,
        age_seconds: workerAgeSeconds,
        current_run_id: worker?.current_run_id || null,
        current_task_id: worker?.current_task_id || null,
      },
      queue: {
        queued_runs: runs.filter((run: any) => run.status === 'queued').length,
        in_progress_runs: runs.filter((run: any) => run.status === 'in_progress').length,
        active_tasks: tasks.filter((task: any) => task.status === 'active').length,
      },
      storage: { tenant_snapshots: tenantStorageReady ? 'ok' : 'missing', path: tenantsRoot },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', checked_at: checkedAt.toISOString(), error: error instanceof Error ? error.message : 'Health check failed' },
      { status: 503 }
    );
  }
}
