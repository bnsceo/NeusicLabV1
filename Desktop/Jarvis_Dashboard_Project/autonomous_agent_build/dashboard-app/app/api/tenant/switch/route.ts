import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/runtimeMode';

export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Tenant switching is disabled in free demo mode' },
        { status: 403 }
      );
    }
    const { tenant } = await req.json();
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set('tenant', tenant, { path: '/' });
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to switch tenant' }, { status: 500 });
  }
}
