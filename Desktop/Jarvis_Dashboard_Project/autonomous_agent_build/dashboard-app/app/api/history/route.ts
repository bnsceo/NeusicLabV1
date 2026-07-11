import { NextRequest, NextResponse } from 'next/server';
import { getAllMissions, searchMissions } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const status = url.searchParams.get('status') || 'all';

    let missions;
    if (query.trim()) {
      missions = await searchMissions(query, status === 'all' ? undefined : status);
    } else {
      missions = await getAllMissions();
      if (status !== 'all') {
        missions = missions.filter(m => m.status === status);
      }
    }

    return NextResponse.json(missions);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
