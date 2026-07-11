import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  let code = '';
  let nextPath = '/';

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    code = String(formData.get('code') || '');
    nextPath = String(formData.get('next') || '/');
  } else {
    const body = await request.json().catch(() => ({ code: '', next: '/' }));
    code = body.code || '';
    nextPath = body.next || '/';
  }

  const accessCode = process.env.TUNNEL_ACCESS_CODE;

  if (!accessCode) {
    return NextResponse.json({ error: 'Tunnel access is not configured.' }, { status: 500 });
  }

  if (code !== accessCode) {
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401 });
  }

  const url = new URL(nextPath, request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set('dominion_access', accessCode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
