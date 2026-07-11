import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { code } = await request.json().catch(() => ({ code: '' }));
  const accessCode = process.env.TUNNEL_ACCESS_CODE;

  if (!accessCode) {
    return NextResponse.json({ error: 'Tunnel access is not configured.' }, { status: 500 });
  }

  if (code !== accessCode) {
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('dominion_access', accessCode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
