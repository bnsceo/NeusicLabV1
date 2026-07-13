import { NextRequest, NextResponse } from 'next/server';
import { buildUnifiedHistory } from '@/lib/operations';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantId();
    const url = new URL(request.url);
    const companyValue = url.searchParams.get('company');
    const limitValue = Number.parseInt(url.searchParams.get('limit') || '200', 10);
    const payload = await buildUnifiedHistory(tenant, {
      query: url.searchParams.get('q') || undefined,
      category: url.searchParams.get('category') || undefined,
      status: url.searchParams.get('status') || undefined,
      companyId: companyValue ? Number(companyValue) : undefined,
      limit: Number.isFinite(limitValue) ? limitValue : 200,
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[history] failed to build timeline', error);
    return NextResponse.json({ error: 'Failed to fetch unified history' }, { status: 500 });
  }
}
