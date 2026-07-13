import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, isAuthRequired, verifyAuthSession } from '@/lib/auth';

const PUBLIC_PATHS = [
  '/unlock',
  '/api/unlock',
  '/api/logout',
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/sw.js',
  '/cyvora-logo.png',
  '/cyvora-header-logo.png',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (!isAuthRequired()) return NextResponse.next();

  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (await verifyAuthSession(session)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/unlock';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api/unlock|api/logout|api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|cyvora-logo.png|cyvora-header-logo.png).*)'],
};
