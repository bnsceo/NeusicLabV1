import { NextRequest, NextResponse } from 'next/server';
import { getAgentBySlug } from '@/lib/agentRegistry';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const agent = getAgentBySlug(slug);
  if (!agent) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  return NextResponse.json({ agent, provider: 'mock', cost_usd: 0 });
}
