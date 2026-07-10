import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { tenant } = await req.json();
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set('tenant', tenant, { path: '/' });
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to switch tenant' }, { status: 500 });
  }
}
