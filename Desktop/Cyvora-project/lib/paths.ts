import path from 'path';

const WORKSPACE_ROOT = process.env.JARVIS_WORKSPACE_ROOT || process.cwd();

export const workspaceRoot = WORKSPACE_ROOT;
export const backendRoot = path.join(/*turbopackIgnore: true*/ workspaceRoot, 'backend');
export const tenantsRoot = process.env.TENANTS_ROOT || path.join(/*turbopackIgnore: true*/ workspaceRoot, 'tenants');
export const logsRoot = process.env.LOGS_ROOT || path.join(/*turbopackIgnore: true*/ workspaceRoot, 'logs');
