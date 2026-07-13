import { NextRequest, NextResponse } from 'next/server';
import { instantiateCompanyTemplate } from '@/lib/companyEngine';
import { getTenantId } from '@/lib/tenant';
import { isDemoMode } from '@/lib/runtimeMode';

export async function POST(request: NextRequest) {
  if (isDemoMode()) return NextResponse.json({ error: 'The public demo is read-only.' }, { status: 403 });
  try {
    const body = await request.json();
    const templateId = typeof body?.templateId === 'string' ? body.templateId.trim() : '';
    if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });
    const tenant = await getTenantId();
    const result = await instantiateCompanyTemplate({
      templateId,
      tenant,
      objective: typeof body?.objective === 'string' ? body.objective : undefined,
      companyName: typeof body?.companyName === 'string' ? body.companyName : undefined,
    });
    return NextResponse.json({ success: true, provider: 'mock', cost_usd: 0, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to instantiate company.' }, { status: 400 });
  }
}
