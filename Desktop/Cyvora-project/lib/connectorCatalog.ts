import { createHash } from 'node:crypto';
import catalogJson from '@/config/connectors.json';

export type ConnectorRisk = 'low' | 'medium' | 'high' | 'critical';
export type ConnectorSideEffect = 'read' | 'read_sensitive' | 'write' | 'publish' | 'financial' | 'destructive';

export type ConnectorActionDefinition = {
  id: string;
  label: string;
  description: string;
  risk: ConnectorRisk;
  sideEffect: ConnectorSideEffect;
  reversible: boolean;
};

export type ConnectorDefinition = {
  id: string;
  name: string;
  category: string;
  summary: string;
  authType: string;
  actions: ConnectorActionDefinition[];
};

export type ConnectorSimulationRequest = {
  connectorId: string;
  actionId: string;
  payload?: Record<string, unknown>;
  tenant: string;
  companyId?: number;
  taskId?: number;
  idempotencyKey?: string;
};

export type ConnectorSimulationResult = {
  connectorId: string;
  connectorName: string;
  actionId: string;
  actionLabel: string;
  mode: 'mock';
  status: 'simulated';
  externalReference: string;
  reversible: boolean;
  costUsd: 0;
  message: string;
  preview: Record<string, unknown>;
};

const catalog = catalogJson as { version: string; connectors: ConnectorDefinition[] };

export function connectorCatalogVersion(): string {
  return catalog.version;
}

export function listConnectorDefinitions(): ConnectorDefinition[] {
  return catalog.connectors.map((connector) => ({
    ...connector,
    actions: connector.actions.map((action) => ({ ...action })),
  }));
}

export function getConnectorDefinition(connectorId: string): ConnectorDefinition | null {
  return listConnectorDefinitions().find((connector) => connector.id === connectorId) || null;
}

export function getConnectorAction(connectorId: string, actionId: string): ConnectorActionDefinition | null {
  return getConnectorDefinition(connectorId)?.actions.find((action) => action.id === actionId) || null;
}

export function simulateConnectorAction(request: ConnectorSimulationRequest): ConnectorSimulationResult {
  const connector = getConnectorDefinition(request.connectorId);
  if (!connector) throw new Error(`Unknown connector: ${request.connectorId}`);
  const action = connector.actions.find((candidate) => candidate.id === request.actionId);
  if (!action) throw new Error(`Unknown action '${request.actionId}' for connector '${request.connectorId}'.`);

  const stableStringify = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      return `{${Object.keys(objectValue).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  };
  const normalized = stableStringify({
    tenant: request.tenant,
    companyId: request.companyId || null,
    taskId: request.taskId || null,
    connectorId: request.connectorId,
    actionId: request.actionId,
    payload: request.payload || {},
    idempotencyKey: request.idempotencyKey || null,
  });

  const seed = request.idempotencyKey || normalized;
  const reference = `mock_${request.connectorId}_${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;

  return {
    connectorId: connector.id,
    connectorName: connector.name,
    actionId: action.id,
    actionLabel: action.label,
    mode: 'mock',
    status: 'simulated',
    externalReference: reference,
    reversible: action.reversible,
    costUsd: 0,
    message: `${connector.name} action simulated. No external service was contacted and no secret was used.`,
    preview: {
      payload: request.payload || {},
      risk: action.risk,
      sideEffect: action.sideEffect,
      reversible: action.reversible,
    },
  };
}

export function publicConnectorSummary() {
  const connectors = listConnectorDefinitions();
  return {
    version: catalog.version,
    connectorCount: connectors.length,
    actionCount: connectors.reduce((total, connector) => total + connector.actions.length, 0),
    mode: 'mock' as const,
    realActionsEnabled: false,
    costUsd: 0,
  };
}
