import { getExecutionRuns } from './db';
import { isProductionMode } from './runtimeMode';

export type BillingPolicy = {
  mode: 'off' | 'warn' | 'enforce';
  maxRunCostUsd: number | null;
  maxDailyCostUsd: number | null;
};

type RuntimePlanLike = {
  token_cost_ceiling?: {
    tokens?: number;
    cost_usd?: string;
  };
};

function parseMoney(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePolicyMode(raw?: string | null): BillingPolicy['mode'] {
  const value = raw?.trim().toLowerCase();
  if (value === 'off' || value === 'warn' || value === 'enforce') return value;
  return isProductionMode() ? 'enforce' : 'warn';
}

export function getBillingPolicy(): BillingPolicy {
  return {
    mode: parsePolicyMode(process.env.CYVORA_BILLING_MODE),
    maxRunCostUsd: parseMoney(process.env.CYVORA_MAX_RUN_COST_USD) ?? (isProductionMode() ? 0.25 : null),
    maxDailyCostUsd: parseMoney(process.env.CYVORA_MAX_DAILY_COST_USD) ?? (isProductionMode() ? 1 : null),
  };
}

export function estimateRunCostUsd(runtimePlan: RuntimePlanLike | null | undefined): number | null {
  if (!runtimePlan?.token_cost_ceiling?.cost_usd) return null;
  return parseMoney(runtimePlan.token_cost_ceiling.cost_usd);
}

export async function estimateTenantDailyCostUsd(tenant: string): Promise<number> {
  const runs = await getExecutionRuns(tenant);
  const today = new Date().toISOString().slice(0, 10);
  return runs.reduce((total, run) => {
    if (!run.started_at?.startsWith(today)) return total;
    const cost = estimateRunCostUsd(run.runtime_plan);
    return total + (cost || 0);
  }, 0);
}

export async function evaluateBillingGate(input: {
  tenant: string;
  runtimePlan: RuntimePlanLike;
}): Promise<{
  allowed: boolean;
  reason?: string;
  policy: BillingPolicy;
  estimatedRunCostUsd: number | null;
  estimatedDailyCostUsd: number;
}> {
  const policy = getBillingPolicy();
  const estimatedRunCostUsd = estimateRunCostUsd(input.runtimePlan);
  const estimatedDailyCostUsd = await estimateTenantDailyCostUsd(input.tenant);

  if (policy.mode === 'off') {
    return {
      allowed: true,
      policy,
      estimatedRunCostUsd,
      estimatedDailyCostUsd,
    };
  }

  if (policy.maxRunCostUsd !== null && estimatedRunCostUsd !== null && estimatedRunCostUsd > policy.maxRunCostUsd) {
    return {
      allowed: policy.mode === 'warn',
      reason: `Estimated run cost $${estimatedRunCostUsd.toFixed(2)} exceeds the configured run ceiling of $${policy.maxRunCostUsd.toFixed(2)}.`,
      policy,
      estimatedRunCostUsd,
      estimatedDailyCostUsd,
    };
  }

  if (policy.maxDailyCostUsd !== null && estimatedDailyCostUsd > policy.maxDailyCostUsd) {
    return {
      allowed: policy.mode === 'warn',
      reason: `Estimated daily cost $${estimatedDailyCostUsd.toFixed(2)} exceeds the configured daily ceiling of $${policy.maxDailyCostUsd.toFixed(2)}.`,
      policy,
      estimatedRunCostUsd,
      estimatedDailyCostUsd,
    };
  }

  return {
    allowed: true,
    policy,
    estimatedRunCostUsd,
    estimatedDailyCostUsd,
  };
}

export function formatBillingSummary(input: {
  estimatedRunCostUsd: number | null;
  estimatedDailyCostUsd: number;
  policy: BillingPolicy;
}): string {
  const runCost = input.estimatedRunCostUsd === null ? 'unknown' : `$${input.estimatedRunCostUsd.toFixed(2)}`;
  const dailyCost = `$${input.estimatedDailyCostUsd.toFixed(2)}`;
  const maxRun = input.policy.maxRunCostUsd === null ? 'unbounded' : `$${input.policy.maxRunCostUsd.toFixed(2)}`;
  const maxDaily = input.policy.maxDailyCostUsd === null ? 'unbounded' : `$${input.policy.maxDailyCostUsd.toFixed(2)}`;
  return `run=${runCost}, daily=${dailyCost}, ceilings run=${maxRun}, daily=${maxDaily}, mode=${input.policy.mode}`;
}

