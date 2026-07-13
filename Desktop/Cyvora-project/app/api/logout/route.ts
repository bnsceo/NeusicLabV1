import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const nextPath = new URL('/unlock', request.url);
  const response = NextResponse.redirect(nextPath);
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    ...getAuthCookieOptions(0),
    maxAge: 0,
  });
  return response;
}

