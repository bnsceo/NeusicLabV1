import { NextResponse } from 'next/server';
import { buildHeadquartersSnapshot } from '@/lib/operations';
import { ensureDemoShowcase } from '@/lib/demoShowcase';
import { isDemoMode } from '@/lib/runtimeMode';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenant = await getTenantId();
    if (isDemoMode()) await ensureDemoShowcase();
    return NextResponse.json(await buildHeadquartersSnapshot(tenant));
  } catch (error) {
    console.error('[headquarters] failed to build snapshot', error);
    return NextResponse.json({ error: 'Failed to load Headquarters' }, { status: 500 });
  }
}
