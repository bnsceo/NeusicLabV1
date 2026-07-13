import policyJson from '@/config/policy-packs.json';
import type { ConnectorRisk, ConnectorSideEffect } from '@/lib/connectorCatalog';

export type PolicyEffect = 'allow' | 'simulate' | 'require_approval' | 'block';
export type SensitiveDataLevel = 'none' | 'internal' | 'personal' | 'financial' | 'regulated';

export type PolicyPack = {
  id: string;
  name: string;
  summary: string;
  autoApproveRisks: ConnectorRisk[];
  approvalRisks: ConnectorRisk[];
  blockedSideEffects: ConnectorSideEffect[];
  approvalSideEffects: ConnectorSideEffect[];
  maxAutoCostUsd: number;
  allowPaidAi: boolean;
  allowRealConnectors: boolean;
  sensitiveExternalRule: 'allow' | 'require_approval' | 'block';
  criticalRule: 'require_approval' | 'block';
};

export type PolicyEvaluationInput = {
  policyPackId?: string;
  connectorId?: string;
  actionId?: string;
  risk: ConnectorRisk;
  sideEffect: ConnectorSideEffect;
  reversible: boolean;
  connectorMode: 'mock' | 'real' | 'disabled';
  providerMode?: 'mock' | 'real';
  estimatedCostUsd?: number;
  sensitiveData?: SensitiveDataLevel;
  environment?: 'demo' | 'founder' | 'production';
  actorRole?: 'founder' | 'admin' | 'operator' | 'agent';
  founderApproved?: boolean;
};

export type PolicyEvaluation = {
  policyPack: string;
  effect: PolicyEffect;
  afterApprovalEffect: Exclude<PolicyEffect, 'require_approval'>;
  risk: ConnectorRisk;
  sideEffect: ConnectorSideEffect;
  reason: string;
  matchedRules: string[];
  requiresFounderApproval: boolean;
  externalActionAllowed: boolean;
  mockSafe: boolean;
  estimatedCostUsd: number;
};

const policyConfig = policyJson as { version: string; defaultPack: string; packs: PolicyPack[] };

export function policyEngineVersion(): string {
  return policyConfig.version;
}

export function listPolicyPacks(): PolicyPack[] {
  return policyConfig.packs.map((pack) => ({ ...pack }));
}

export function getPolicyPack(id?: string): PolicyPack {
  const selected = policyConfig.packs.find((pack) => pack.id === (id || policyConfig.defaultPack));
  if (selected) return { ...selected };
  const fallback = policyConfig.packs.find((pack) => pack.id === policyConfig.defaultPack);
  if (!fallback) throw new Error('Default policy pack is missing.');
  return { ...fallback };
}

function finalExecutionEffect(input: PolicyEvaluationInput): 'allow' | 'simulate' | 'block' {
  if (input.connectorMode === 'disabled') return 'block';
  return input.connectorMode === 'mock' ? 'simulate' : 'allow';
}

export function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluation {
  const pack = getPolicyPack(input.policyPackId);
  const matchedRules: string[] = [];
  const cost = Math.max(0, Number(input.estimatedCostUsd || 0));
  const sensitive = input.sensitiveData || 'none';
  const environment = input.environment || 'founder';
  const actorRole = input.actorRole || 'agent';
  const executionEffect = finalExecutionEffect(input);

  let effect: PolicyEffect = executionEffect;
  let reason = input.connectorMode === 'mock'
    ? 'Mock connector execution is permitted at $0 cost.'
    : 'The action is permitted by the selected policy pack.';

  if (input.connectorMode === 'disabled') {
    matchedRules.push('connector_mode_disabled');
    effect = 'block';
    reason = 'Connector execution is disabled.';
  }

  if (input.providerMode === 'real' && cost > 0 && !pack.allowPaidAi) {
    matchedRules.push('paid_ai_disabled');
    effect = 'block';
    reason = 'Paid AI execution is disabled by this policy pack.';
  }

  if (cost > pack.maxAutoCostUsd) {
    matchedRules.push('cost_above_auto_limit');
    effect = 'block';
    reason = `Estimated cost $${cost.toFixed(4)} exceeds the automatic limit of $${pack.maxAutoCostUsd.toFixed(4)}.`;
  }

  if (input.connectorMode === 'real' && !pack.allowRealConnectors) {
    matchedRules.push('real_connectors_disabled');
    effect = 'block';
    reason = 'Real connector execution is disabled by this policy pack.';
  }

  if (pack.blockedSideEffects.includes(input.sideEffect)) {
    matchedRules.push(`blocked_side_effect:${input.sideEffect}`);
    effect = 'block';
    reason = `${input.sideEffect} actions are blocked by the selected policy pack.`;
  }

  if (input.risk === 'critical') {
    matchedRules.push(`critical_action:${pack.criticalRule}`);
    if (pack.criticalRule === 'block') {
      effect = 'block';
      reason = 'Critical actions are blocked by this policy pack.';
    } else if (effect !== 'block') {
      effect = input.founderApproved ? executionEffect : 'require_approval';
      reason = input.founderApproved ? 'Founder approval satisfied for a critical action.' : 'Critical actions require founder approval.';
    }
  }

  const sensitiveExternal = sensitive !== 'none' && !['read', 'write'].includes(input.sideEffect);
  if (sensitiveExternal && effect !== 'block') {
    matchedRules.push(`sensitive_external:${pack.sensitiveExternalRule}`);
    if (pack.sensitiveExternalRule === 'block') {
      effect = 'block';
      reason = 'Sensitive data cannot be sent through this external action.';
    } else if (pack.sensitiveExternalRule === 'require_approval') {
      effect = input.founderApproved ? executionEffect : 'require_approval';
      reason = input.founderApproved ? 'Founder approval satisfied for sensitive external data.' : 'Sensitive external data requires founder approval.';
    }
  }

  const needsApproval = pack.approvalRisks.includes(input.risk) || pack.approvalSideEffects.includes(input.sideEffect);
  if (needsApproval && effect !== 'block') {
    matchedRules.push(`approval_gate:${input.risk}:${input.sideEffect}`);
    effect = input.founderApproved ? executionEffect : 'require_approval';
    reason = input.founderApproved
      ? 'Founder approval satisfied; the governed action may proceed.'
      : `${input.risk} risk or ${input.sideEffect} side effects require founder approval.`;
  }

  if (environment === 'demo' && input.sideEffect !== 'read') {
    matchedRules.push('public_demo_read_only');
    effect = 'block';
    reason = 'The public demo is read-only.';
  }

  if (actorRole === 'agent' && !input.reversible && effect !== 'block') {
    matchedRules.push('irreversible_agent_action');
    effect = input.founderApproved ? executionEffect : 'require_approval';
    reason = input.founderApproved ? 'Founder approval satisfied for an irreversible action.' : 'Irreversible agent actions require founder approval.';
  }

  if (input.founderApproved && effect !== 'block') matchedRules.push('founder_approval_satisfied');
  if (!matchedRules.length) matchedRules.push(input.connectorMode === 'mock' ? 'mock_safe_default' : 'policy_default_allow');

  return {
    policyPack: pack.id,
    effect,
    afterApprovalEffect: executionEffect,
    risk: input.risk,
    sideEffect: input.sideEffect,
    reason,
    matchedRules,
    requiresFounderApproval: effect === 'require_approval',
    externalActionAllowed: effect === 'allow',
    mockSafe: effect === 'simulate' || (effect === 'require_approval' && input.connectorMode === 'mock'),
    estimatedCostUsd: cost,
  };
}

export function publicPolicySummary() {
  return {
    version: policyConfig.version,
    defaultPack: policyConfig.defaultPack,
    packs: listPolicyPacks(),
    guarantees: {
      defaultCostUsd: 0,
      paidAiDisabled: true,
      realConnectorsDisabled: true,
      consequentialActionsGoverned: true,
    },
  };
}
