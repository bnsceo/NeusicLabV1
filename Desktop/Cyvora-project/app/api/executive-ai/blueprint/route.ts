import { NextRequest, NextResponse } from 'next/server';
import { buildExecutiveBlueprint } from '@/lib/executiveBlueprint';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const objective = typeof body?.objective === 'string' ? body.objective.trim() : '';
    if (!objective) return NextResponse.json({ error: 'Objective is required.' }, { status: 400 });
    if (objective.length > 3000) return NextResponse.json({ error: 'Objective must be 3,000 characters or fewer.' }, { status: 400 });
    return NextResponse.json({
      success: true,
      provider: 'mock',
      cost_usd: 0,
      blueprint: buildExecutiveBlueprint(objective),
    });
  } catch {
    return NextResponse.json({ error: 'Unable to build blueprint.' }, { status: 400 });
  }
}
