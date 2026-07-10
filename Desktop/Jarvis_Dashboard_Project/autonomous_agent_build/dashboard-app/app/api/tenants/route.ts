import { NextRequest, NextResponse } from 'next/server';
import { listTenants, createTenant } from '@/lib/tenant';

export async function GET() {
  try {
    const tenants = listTenants();
    return NextResponse.json(tenants);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list tenants' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
