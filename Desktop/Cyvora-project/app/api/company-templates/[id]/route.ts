import { NextRequest, NextResponse } from 'next/server';
import { getCompanyTemplate } from '@/lib/companyEngine';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const template = getCompanyTemplate(id);
  if (!template) return NextResponse.json({ error: 'Company template not found.' }, { status: 404 });
  return NextResponse.json({ template, cost_usd: 0, provider: 'mock' });
}
