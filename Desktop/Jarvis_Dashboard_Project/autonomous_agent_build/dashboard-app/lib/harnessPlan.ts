export type HarnessPlan = {
  sandbox_scope: string[];
  permissions: string[];
  validation_checks: string[];
  rollback_path: string[];
  token_cost_ceiling: {
    tokens: number;
    cost_usd: string;
  };
  runtime_notes: string[];
};

export function buildHarnessPlan(request: string): HarnessPlan {
  const text = request.toLowerCase();
  const isDeploy = text.includes('deploy') || text.includes('production') || text.includes('publish');
  const isDataHeavy = text.includes('database') || text.includes('data') || text.includes('migrate');
  const isUiHeavy = text.includes('ui') || text.includes('ux') || text.includes('dashboard') || text.includes('screen');

  const sandbox_scope = [
    'Local workspace only',
    'Temp file writes under /private/tmp',
    isDeploy ? 'No production deploys without approval' : 'No external side effects',
  ];

  const permissions = [
    'Read source tree',
    'Write only within the project workspace',
    'No secret access unless explicitly granted',
    ...(isDataHeavy ? ['Scoped SQLite access'] : []),
    ...(isDeploy ? ['Approval required for release actions'] : []),
  ];

  const validation_checks = [
    'ESLint passes',
    'TypeScript passes',
    'Production build passes',
    'Runtime diff matches request',
    ...(isUiHeavy ? ['Visual hierarchy preserves nesting'] : []),
    ...(isDataHeavy ? ['Data schema and route outputs are consistent'] : []),
  ];

  const rollback_path = [
    'Keep the previous commit reachable',
    'Restore the prior page or route file if validation fails',
    'Revert the latest database or schema change before retrying',
    'Stop the loop immediately on deterministic test failure',
  ];

  const tokenBudget = isDeploy ? 12000 : 8000;
  const costBudget = isDeploy ? '$0.15' : '$0.08';

  const runtime_notes = [
    'Run inside the smallest useful harness.',
    'Prefer deterministic checks over model opinion.',
    'Escalate to human approval before stateful or irreversible actions.',
    'Keep logs and diffs visible for each iteration.',
  ];

  return {
    sandbox_scope,
    permissions,
    validation_checks,
    rollback_path,
    token_cost_ceiling: {
      tokens: tokenBudget,
      cost_usd: costBudget,
    },
    runtime_notes,
  };
}
