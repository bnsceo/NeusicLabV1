import { NextRequest, NextResponse } from 'next/server';
import { getConnectorAction, getConnectorDefinition, simulateConnectorAction } from '@/lib/connectorCatalog';
import { saveConnectorActionRun, savePolicyDecision } from '@/lib/db';
import { evaluatePolicy } from '@/lib/policyEngine';
import { isDemoMode } from '@/lib/runtimeMode';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const connectorId = typeof body?.connectorId === 'string' ? body.connectorId.trim() : '';
    const actionId = typeof body?.actionId === 'string' ? body.actionId.trim() : '';
    const connector = getConnectorDefinition(connectorId);
    const action = getConnectorAction(connectorId, actionId);
    if (!connector || !action) return NextResponse.json({ error: 'A valid connectorId and actionId are required.' }, { status: 400 });

    const tenant = await getTenantId();
    const founderApproved = body?.founderApproved === true;
    const policyInput = {
      policyPackId: typeof body?.policyPackId === 'string' ? body.policyPackId : undefined,
      connectorId,
      actionId,
      risk: action.risk,
      sideEffect: action.sideEffect,
      reversible: action.reversible,
      connectorMode: 'mock' as const,
      providerMode: 'mock' as const,
      estimatedCostUsd: 0,
      sensitiveData: body?.sensitiveData || 'none',
      environment: isDemoMode() ? 'demo' as const : 'founder' as const,
      actorRole: body?.requestedBy === 'founder' ? 'founder' as const : 'agent' as const,
      founderApproved,
    };
    const decision = evaluatePolicy(policyInput);

    const common = {
      tenant,
      company_id: Number.isInteger(body?.companyId) ? body.companyId : undefined,
      task_id: Number.isInteger(body?.taskId) ? body.taskId : undefined,
      connector_id: connectorId,
      action_id: actionId,
      mode: 'mock',
      policy_effect: decision.effect,
      risk_level: action.risk,
      side_effect: action.sideEffect,
      reversible: action.reversible,
      idempotency_key: typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
      payload: body?.payload && typeof body.payload === 'object' ? body.payload : {},
      requested_by: body?.requestedBy === 'founder' ? 'founder' : 'agent',
    };

    if (decision.effect === 'block') {
      const runId = await saveConnectorActionRun({ ...common, status: 'blocked', result: { reason: decision.reason }, completed: true });
      await savePolicyDecision({
        tenant,
        company_id: common.company_id,
        task_id: common.task_id,
        connector_action_run_id: runId,
        policy_pack: decision.policyPack,
        effect: decision.effect,
        risk_level: action.risk,
        side_effect: action.sideEffect,
        reason: decision.reason,
        matched_rules: decision.matchedRules,
        input: policyInput,
      });
      return NextResponse.json({ connector, action, decision, status: 'blocked' }, { status: 403 });
    }

    if (decision.effect === 'require_approval') {
      const runId = await saveConnectorActionRun({ ...common, status: 'awaiting_approval', result: { reason: decision.reason } });
      await savePolicyDecision({
        tenant,
        company_id: common.company_id,
        task_id: common.task_id,
        connector_action_run_id: runId,
        policy_pack: decision.policyPack,
        effect: decision.effect,
        risk_level: action.risk,
        side_effect: action.sideEffect,
        reason: decision.reason,
        matched_rules: decision.matchedRules,
        input: policyInput,
      });
      return NextResponse.json({ connector, action, decision, status: 'awaiting_approval', actionRunId: runId }, { status: 202 });
    }

    const result = simulateConnectorAction({
      connectorId,
      actionId,
      payload: common.payload,
      tenant,
      companyId: common.company_id,
      taskId: common.task_id,
      idempotencyKey: common.idempotency_key,
    });
    const runId = await saveConnectorActionRun({
      ...common,
      status: 'simulated',
      external_reference: result.externalReference,
      result,
      completed: true,
    });
    await savePolicyDecision({
      tenant,
      company_id: common.company_id,
      task_id: common.task_id,
      connector_action_run_id: runId,
      policy_pack: decision.policyPack,
      effect: decision.effect,
      risk_level: action.risk,
      side_effect: action.sideEffect,
      reason: decision.reason,
      matched_rules: decision.matchedRules,
      input: policyInput,
    });
    return NextResponse.json({ connector, action, decision, result, status: 'simulated', actionRunId: runId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to simulate connector action.' }, { status: 400 });
  }
}
