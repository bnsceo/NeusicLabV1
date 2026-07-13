import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ensureTenantDirectories } from '@/lib/tenant';

// We'll store last poll timestamp and last alert in a file
const LAST_POLL_FILE = 'last_poll.json';

interface LogError {
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await req.cookies;
    const tenant = cookieStore.get('tenant')?.value || 'default';
    const tenantPath = ensureTenantDirectories(tenant);
    const logPath = path.join(tenantPath, 'logs', 'error.log');
    const pollPath = path.join(tenantPath, 'logs', LAST_POLL_FILE);

    // Read last poll info
    let lastPoll = { timestamp: '', lastAlert: '' };
    try {
      lastPoll = JSON.parse(fs.readFileSync(pollPath, 'utf-8'));
    } catch {}

    // Read log file
    let content = '';
    try {
      content = fs.readFileSync(logPath, 'utf-8');
    } catch {
      return NextResponse.json({ message: 'No log file found.' });
    }

    const lines = content.split('\n').filter(Boolean);
    // Parse lines with timestamp format [YYYY-MM-DD HH:MM:SS]
    const errors = lines
      .map(line => {
        const match = line.match(/\[(.*?)\]\s*(\w+):\s*(.*)/);
        if (match) {
          return { timestamp: match[1], level: match[2], message: match[3], raw: line };
        }
        return null;
      })
      .filter((error): error is LogError => error !== null);

    if (errors.length === 0) {
      return NextResponse.json({ message: 'No errors found.' });
    }

    // Find new errors after last poll
    const lastTimestamp = lastPoll.timestamp || '1970-01-01 00:00:00';
    const newErrors = errors.filter(e => e.timestamp > lastTimestamp);

    if (newErrors.length === 0) {
      return NextResponse.json({ message: 'No new errors since last poll.' });
    }

    // Trigger repair for the first new error (if not already triggered recently)
    const firstError = newErrors[0];
    // Avoid duplicate triggers for same error if recently alerted
    if (firstError.raw === lastPoll.lastAlert) {
      return NextResponse.json({ message: 'Last alert already triggered for this error.' });
    }

    // Call the repair endpoint internally
    const repairResponse = await fetch(new URL('/api/repair', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert: firstError.message }),
    });
    const repairData = await repairResponse.json();

    // Update last poll info
    const newPoll = { timestamp: firstError.timestamp, lastAlert: firstError.raw };
    fs.writeFileSync(pollPath, JSON.stringify(newPoll, null, 2));

    return NextResponse.json({
      message: 'Triggered repair for new error.',
      error: firstError,
      repair: repairData,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to poll logs' }, { status: 500 });
  }
}
