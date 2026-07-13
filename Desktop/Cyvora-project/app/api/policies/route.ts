import { NextResponse } from 'next/server';
import { getPolicyDecisions } from '@/lib/db';
import { publicPolicySummary } from '@/lib/policyEngine';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenant = await getTenantId();
    const recentDecisions = await getPolicyDecisions(tenant, 30);
    return NextResponse.json({ ...publicPolicySummary(), recentDecisions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load policy engine.' }, { status: 500 });
  }
}
