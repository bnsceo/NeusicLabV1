import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/unlock',
  '/api/unlock',
  '/_next',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/sw.js',
  '/dominion-logo.svg',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const accessCode = process.env.TUNNEL_ACCESS_CODE;
  if (!accessCode) return NextResponse.next();

  const cookie = request.cookies.get('dominion_access')?.value;
  if (cookie === accessCode) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/unlock';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api/unlock|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|dominion-logo.svg).*)'],
};
