import { NextResponse } from 'next/server';
import { getTenantValidationRuns } from '@/lib/db';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenant = await getTenantId();
    return NextResponse.json(await getTenantValidationRuns(tenant, 100));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load validation runs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
