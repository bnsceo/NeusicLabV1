import { NextResponse } from 'next/server';

export async function GET() {
  const stats = {
    totalCalls: 142,
    topAgents: [
      { name: 'Frontend Developer', calls: 45 },
      { name: 'UX Architect', calls: 32 },
      { name: 'Copywriter', calls: 28 },
      { name: 'Performance Benchmarker', calls: 37 },
    ],
    averageResponseTime: '2.3s',
  };
  return NextResponse.json(stats);
}
