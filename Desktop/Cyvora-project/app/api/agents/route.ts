import { NextRequest, NextResponse } from 'next/server';
import { getAgentRegistry, getAgentRegistryStats } from '@/lib/agentRegistry';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const agents = getAgentRegistry({
    query: params.get('q') || undefined,
    category: params.get('category') || undefined,
    risk: params.get('risk') || undefined,
    source: params.get('source') || undefined,
  });
  const limit = Math.min(Math.max(Number(params.get('limit') || '250'), 1), 500);
  return NextResponse.json({ agents: agents.slice(0, limit), stats: getAgentRegistryStats(), provider: 'mock', cost_usd: 0 });
}
