import path from 'path';
import fs from 'fs';
import { cookies } from 'next/headers';
import { logsRoot, tenantsRoot } from './paths';
import { isDemoMode } from './runtimeMode';

export async function getTenantId(): Promise<string> {
  const cookieStore = await cookies();
  const cookieTenant = cookieStore.get('tenant')?.value || 'default';
  return isDemoMode() ? 'demo' : cookieTenant;
}

export function getTenantPath(tenantId?: string): string {
  const id = isDemoMode() ? 'demo' : tenantId || 'default';
  return path.join(tenantsRoot, id);
}

export function ensureTenantDirectories(tenantId?: string) {
  const tenantPath = getTenantPath(tenantId);
  const dirs = ['logs', 'briefings', 'security'];
  for (const d of dirs) {
    const dirPath = path.join(tenantPath, d);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  return tenantPath;
}

export function listTenants(): string[] {
  if (isDemoMode()) return ['demo'];
  if (!fs.existsSync(tenantsRoot)) return ['default'];
  return fs.readdirSync(tenantsRoot).filter((f) =>
    fs.statSync(path.join(tenantsRoot, f)).isDirectory()
  );
}

export function createTenant(name: string): void {
  if (isDemoMode()) return;
  const tenantPath = path.join(tenantsRoot, name);
  if (!fs.existsSync(tenantPath)) {
    fs.mkdirSync(tenantPath, { recursive: true });
    const dirs = ['logs', 'briefings', 'security'];
    for (const d of dirs) {
      fs.mkdirSync(path.join(/*turbopackIgnore: true*/ tenantPath, d), { recursive: true });
    }
    const defaultLog = path.join(logsRoot, 'error.log');
    if (fs.existsSync(defaultLog)) {
      fs.copyFileSync(defaultLog, path.join(/*turbopackIgnore: true*/ tenantPath, 'logs', 'error.log'));
    }
  }
}
