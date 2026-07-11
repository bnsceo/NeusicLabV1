import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ensureTenantDirectories } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await req.cookies;
    const tenant = cookieStore.get('tenant')?.value || 'default';
    const tenantPath = ensureTenantDirectories(tenant);
    const logPath = path.join(tenantPath, 'logs', 'error.log');
    let incidents = [];

    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      incidents = lines.map((line, index) => {
        const match = line.match(/\[(.*?)\]\s*(\w+):\s*(.*)/);
        if (match) {
          return {
            id: index + 1,
            timestamp: match[1],
            severity: match[2].toLowerCase(),
            title: match[3],
          };
        }
        return { id: index + 1, timestamp: new Date().toISOString(), severity: 'info', title: line };
      });
    } catch {
      incidents = [
        { id: 1, timestamp: new Date().toISOString(), severity: 'info', title: 'No errors detected. System healthy.' },
      ];
    }

    return NextResponse.json(incidents);
  } catch {
    return NextResponse.json([]);
  }
}
