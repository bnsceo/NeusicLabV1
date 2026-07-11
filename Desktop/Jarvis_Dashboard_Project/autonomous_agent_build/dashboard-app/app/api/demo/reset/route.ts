import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/runtimeMode';
import { resetDemoShowcase } from '@/lib/demoShowcase';

export async function POST() {
  try {
    if (!isDemoMode()) {
      return NextResponse.json(
        { error: 'Demo reset is only available in free demo mode' },
        { status: 403 }
      );
    }

    await resetDemoShowcase();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset demo showcase' }, { status: 500 });
  }
}
