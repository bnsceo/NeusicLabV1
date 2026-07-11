import fs from 'fs';
import path from 'path';
import { ensureTenantDirectories } from './tenant';
import type { HarnessPlan } from './harnessPlan';

export type HarnessApprovalSnapshot = {
  request_id: number;
  tenant: string;
  request: string;
  approval_state: 'approved';
  runtime_plan: HarnessPlan;
  approved_at: string;
  approval_stage: string;
};

function getApprovalSnapshotPath(tenant: string, requestId: number): string {
  const tenantPath = ensureTenantDirectories(tenant);
  return path.join(/*turbopackIgnore: true*/ tenantPath, 'briefings', `harness_approval_${requestId}.json`);
}

export function saveHarnessApprovalSnapshot(snapshot: HarnessApprovalSnapshot): string {
  const filePath = getApprovalSnapshotPath(snapshot.tenant, snapshot.request_id);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  return filePath;
}

export function loadHarnessApprovalSnapshot(
  tenant: string,
  requestId: number
): HarnessApprovalSnapshot | null {
  const filePath = getApprovalSnapshotPath(tenant, requestId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as HarnessApprovalSnapshot;
  } catch {
    return null;
  }
}

export function clearHarnessApprovalSnapshot(tenant: string, requestId: number): void {
  const filePath = getApprovalSnapshotPath(tenant, requestId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
