import { NextRequest, NextResponse } from 'next/server';
import { listTenants, createTenant } from '@/lib/tenant';
import { isDemoMode } from '@/lib/runtimeMode';

export async function GET() {
  try {
    const tenants = listTenants();
    return NextResponse.json(tenants);
  } catch {
    return NextResponse.json({ error: 'Failed to list tenants' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Tenant creation is disabled in free demo mode' },
        { status: 403 }
      );
    }
    const { name } = await req.json();
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 });
    }
    createTenant(name.trim());
    return NextResponse.json({ success: true, tenants: listTenants() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
