export type RuntimeMode = 'local' | 'demo' | 'production';

type RuntimeModeInfo = {
  mode: RuntimeMode;
  label: string;
  description: string;
  allowPaidAI: boolean;
  mockMode: boolean;
  readOnlyDemo: boolean;
};

function normalizeMode(raw?: string | null): RuntimeMode {
  const value = raw?.trim().toLowerCase();
  if (value === 'demo' || value === 'production' || value === 'local') {
    return value;
  }
  return 'local';
}

export function getRuntimeMode(): RuntimeMode {
  return normalizeMode(process.env.NEXT_PUBLIC_APP_RUNTIME_MODE);
}

export function isLocalMode(): boolean {
  return getRuntimeMode() === 'local';
}

export function isDemoMode(): boolean {
  return getRuntimeMode() === 'demo';
}

export function isProductionMode(): boolean {
  return getRuntimeMode() === 'production';
}

function getPaidAiFlag(): boolean {
  const raw = process.env.NEXT_PUBLIC_ALLOW_PAID_AI ?? process.env.ALLOW_PAID_AI;
  return raw === 'true';
}

export function allowsPaidAI(): boolean {
  return isProductionMode() && getPaidAiFlag() && process.env.MOCK_MODE !== 'true';
}

export function shouldUseMockMode(): boolean {
  if (!isProductionMode()) {
    return true;
  }
  if (process.env.MOCK_MODE === 'true') {
    return true;
  }
  return !allowsPaidAI();
}

export function isReadOnlyDemo(): boolean {
  return isDemoMode();
}

export function getRuntimeModeInfo(): RuntimeModeInfo {
  const mode = getRuntimeMode();
  if (mode === 'demo') {
    return {
      mode,
      label: 'Free Demo',
      description: 'Public read-only demo with local execution and no paid APIs.',
      allowPaidAI: false,
      mockMode: true,
      readOnlyDemo: true,
    };
  }
  if (mode === 'production') {
    return {
      mode,
      label: allowsPaidAI() ? 'Production' : 'Production Locked',
      description: allowsPaidAI()
        ? 'Paid APIs are enabled for production workloads.'
        : 'Production runtime is configured, but paid APIs stay off until explicitly enabled.',
      allowPaidAI: allowsPaidAI(),
      mockMode: shouldUseMockMode(),
      readOnlyDemo: false,
    };
  }
  return {
    mode,
    label: 'Local Mode',
    description: 'Fully local execution using local tooling and mock-safe fallbacks.',
    allowPaidAI: false,
    mockMode: true,
    readOnlyDemo: false,
  };
}

export function getRuntimeModeSummary(): string {
  const info = getRuntimeModeInfo();
  return `${info.label} · ${info.description}`;
}
