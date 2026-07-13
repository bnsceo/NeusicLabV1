import { publicConnectorSummary } from '@/lib/connectorCatalog';
import { publicPolicySummary } from '@/lib/policyEngine';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function enabled(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export async function GET() {
  const explicitProvider = process.env.CYVORA_MODEL_PROVIDER?.trim().toLowerCase();
  const mockMode = enabled('MOCK_MODE', true);
  const selectedProvider = explicitProvider || (mockMode ? 'mock' : 'anthropic');
  const connectorMode = process.env.CYVORA_CONNECTOR_MODE?.trim().toLowerCase() || 'mock';

  return NextResponse.json({
    model_provider: {
      selected: selectedProvider,
      available: ['mock', 'anthropic'],
      mock_safe: selectedProvider === 'mock',
      paid_ai_allowed: enabled('ALLOW_PAID_AI', false),
      credentials_configured: selectedProvider === 'mock' ? true : Boolean(process.env.ANTHROPIC_API_KEY),
    },
    connectors: {
      ...publicConnectorSummary(),
      mode: connectorMode,
      mock_safe: connectorMode === 'mock',
      real_actions_enabled: false,
    },
    policy_engine: publicPolicySummary(),
    guarantees: {
      external_side_effects_disabled: true,
      secrets_exposed: false,
      public_status_only: true,
    },
  });
}
