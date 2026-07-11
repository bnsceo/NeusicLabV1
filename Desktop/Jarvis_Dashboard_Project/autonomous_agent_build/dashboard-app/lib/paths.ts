import path from 'path';

const WORKSPACE_ROOT = process.env.JARVIS_WORKSPACE_ROOT;

if (!WORKSPACE_ROOT) {
  throw new Error('JARVIS_WORKSPACE_ROOT is not set');
}

export const workspaceRoot = WORKSPACE_ROOT;
export const backendRoot = path.join(/*turbopackIgnore: true*/ workspaceRoot, 'backend');
export const tenantsRoot = path.join(/*turbopackIgnore: true*/ workspaceRoot, 'tenants');
export const logsRoot = path.join(/*turbopackIgnore: true*/ workspaceRoot, 'logs');
