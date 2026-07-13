import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, createAuthSession, getAccessCode, getAuthCookieOptions, isAuthRequired } from '@/lib/auth';

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

  const accessCode = getAccessCode();
  if (!accessCode && isAuthRequired()) {
    return NextResponse.json({ error: 'Tunnel access is not configured.' }, { status: 500 });
  }

  if (code !== accessCode) {
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401 });
  }

  const url = new URL(nextPath, request.url);
  const response = NextResponse.redirect(url);
  const session = await createAuthSession();
  response.cookies.set(AUTH_COOKIE_NAME, session, getAuthCookieOptions());
  return response;
}
