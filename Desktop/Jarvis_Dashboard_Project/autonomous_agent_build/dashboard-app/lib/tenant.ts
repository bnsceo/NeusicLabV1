import path from 'path';
import fs from 'fs';

const TENANTS_ROOT = path.join(process.cwd(), '..', 'tenants');

export function getTenantPath(tenantId: string): string {
  return path.join(TENANTS_ROOT, tenantId);
}

export function ensureTenantDirectories(tenantId: string) {
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
  if (!fs.existsSync(TENANTS_ROOT)) return ['default'];
  return fs.readdirSync(TENANTS_ROOT).filter((f) =>
    fs.statSync(path.join(TENANTS_ROOT, f)).isDirectory()
  );
}

export function createTenant(name: string): void {
  const tenantPath = path.join(TENANTS_ROOT, name);
  if (!fs.existsSync(tenantPath)) {
    fs.mkdirSync(tenantPath, { recursive: true });
    const dirs = ['logs', 'briefings', 'security'];
    for (const d of dirs) {
      fs.mkdirSync(path.join(tenantPath, d), { recursive: true });
    }
    const defaultLog = path.join(process.cwd(), '..', 'logs', 'error.log');
    if (fs.existsSync(defaultLog)) {
      fs.copyFileSync(defaultLog, path.join(tenantPath, 'logs', 'error.log'));
    }
  }
}
