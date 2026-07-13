import { NextRequest, NextResponse } from 'next/server';
import { getMission } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    const mission = await getMission(id);
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }
    // Parse agents JSON back to array
    mission.agents = JSON.parse(mission.agents);
    return NextResponse.json(mission);
  } catch {
    return NextResponse.json({ error: 'Failed to load mission' }, { status: 500 });
  }
}
