import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getExecutionRuns } from '@/lib/db';
import { ensureDemoShowcase } from '@/lib/demoShowcase';
import { isDemoMode } from '@/lib/runtimeMode';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantId();
    if (isDemoMode()) {
      await ensureDemoShowcase();
    }
    const url = new URL(req.url);
    const limit = Number.parseInt(url.searchParams.get('limit') || '10', 10);
    const runs = await getExecutionRuns(tenant);
    return NextResponse.json(runs.slice(0, Number.isNaN(limit) ? 10 : limit));
  } catch {
    return NextResponse.json({ error: 'Failed to load execution runs' }, { status: 500 });
  }
}
