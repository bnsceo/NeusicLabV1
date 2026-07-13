import { NextRequest, NextResponse } from 'next/server';
import { listConnectorDefinitions, publicConnectorSummary } from '@/lib/connectorCatalog';
import { getConnectorActionRuns, getConnectorInstallations, upsertConnectorInstallation } from '@/lib/db';
import { isDemoMode } from '@/lib/runtimeMode';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenant = await getTenantId();
    const [installations, recentActions] = await Promise.all([
      getConnectorInstallations(tenant),
      getConnectorActionRuns(tenant, 20),
    ]);
    const installationById = new Map(installations.map((item: any) => [item.connector_id, item]));
    const connectors = listConnectorDefinitions().map((connector) => ({
      ...connector,
      installation: installationById.get(connector.id) || {
        connector_id: connector.id,
        mode: 'mock',
        status: 'available',
        enabled: true,
        config: {},
      },
    }));
    return NextResponse.json({ summary: publicConnectorSummary(), connectors, recentActions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load connectors.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (isDemoMode()) return NextResponse.json({ error: 'The public demo is read-only.' }, { status: 403 });
  try {
    const body = await request.json();
    const connectorId = typeof body?.connectorId === 'string' ? body.connectorId.trim() : '';
    if (!connectorId) return NextResponse.json({ error: 'connectorId is required.' }, { status: 400 });
    const tenant = await getTenantId();
    await upsertConnectorInstallation({
      tenant,
      company_id: Number.isInteger(body?.companyId) ? body.companyId : undefined,
      connector_id: connectorId,
      mode: body?.mode === 'disabled' ? 'disabled' : 'mock',
      status: body?.enabled === false ? 'disabled' : 'enabled',
      enabled: body?.enabled !== false,
      config: {},
    });
    return NextResponse.json({ success: true, connectorId, mode: body?.mode === 'disabled' ? 'disabled' : 'mock', cost_usd: 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update connector.' }, { status: 400 });
  }
}
