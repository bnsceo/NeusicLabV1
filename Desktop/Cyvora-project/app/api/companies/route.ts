import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant';
import { getCompanies } from '@/lib/db';
import { ensureDemoShowcase } from '@/lib/demoShowcase';
import { isDemoMode } from '@/lib/runtimeMode';

export async function GET() {
  try {
    const tenant = await getTenantId();
    if (isDemoMode()) {
      await ensureDemoShowcase();
    }
    const companies = await getCompanies(tenant);
    return NextResponse.json(companies);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
