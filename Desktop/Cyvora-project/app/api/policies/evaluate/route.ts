import { NextRequest, NextResponse } from 'next/server';
import { getConnectorAction } from '@/lib/connectorCatalog';
import { savePolicyDecision } from '@/lib/db';
import { evaluatePolicy } from '@/lib/policyEngine';
import { isDemoMode } from '@/lib/runtimeMode';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = getConnectorAction(String(body?.connectorId || ''), String(body?.actionId || ''));
    const risk = action?.risk || body?.risk || 'medium';
    const sideEffect = action?.sideEffect || body?.sideEffect || 'write';
    const reversible = action?.reversible ?? body?.reversible !== false;
    const tenant = await getTenantId();
    const input = {
      policyPackId: typeof body?.policyPackId === 'string' ? body.policyPackId : undefined,
      connectorId: typeof body?.connectorId === 'string' ? body.connectorId : undefined,
      actionId: typeof body?.actionId === 'string' ? body.actionId : undefined,
      risk,
      sideEffect,
      reversible,
      connectorMode: body?.connectorMode === 'real' || body?.connectorMode === 'disabled' ? body.connectorMode : 'mock',
      providerMode: body?.providerMode === 'real' ? 'real' as const : 'mock' as const,
      estimatedCostUsd: Number(body?.estimatedCostUsd || 0),
      sensitiveData: body?.sensitiveData || 'none',
      environment: isDemoMode() ? 'demo' as const : 'founder' as const,
      actorRole: body?.actorRole || 'agent',
      founderApproved: body?.founderApproved === true,
    };
    const decision = evaluatePolicy(input);
    const decisionId = await savePolicyDecision({
      tenant,
      company_id: Number.isInteger(body?.companyId) ? body.companyId : undefined,
      task_id: Number.isInteger(body?.taskId) ? body.taskId : undefined,
      policy_pack: decision.policyPack,
      effect: decision.effect,
      risk_level: decision.risk,
      side_effect: decision.sideEffect,
      reason: decision.reason,
      matched_rules: decision.matchedRules,
      input,
    });
    return NextResponse.json({ decisionId, decision });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to evaluate policy.' }, { status: 400 });
  }
}
