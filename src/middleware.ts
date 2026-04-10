import { NextRequest, NextResponse } from 'next/server';

// Decode JWT payload without verifying signature (verification still happens in API routes)
function getTokenPayload(token: string): { role?: string; exp?: number } | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token   = req.cookies.get('authToken')?.value;
  const payload = token ? getTokenPayload(token) : null;

  // Treat expired tokens as logged-out
  const isLoggedIn = !!payload && (!payload.exp || payload.exp * 1000 > Date.now());
  const role       = payload?.role ?? '';

  // ── Already logged in → redirect away from auth pages ──────────────────────
  if (pathname === '/login' || pathname === '/register') {
    if (isLoggedIn) {
      const dest = role === 'admin' ? '/admin' : role === 'agent' ? '/agent' : '/';
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // ── Admin only ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) return NextResponse.redirect(new URL('/login', req.url));
    if (role !== 'admin') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  // ── Agent only ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/agent')) {
    if (!isLoggedIn) return NextResponse.redirect(new URL('/login', req.url));
    if (role !== 'agent' && role !== 'admin') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  // ── Login required ──────────────────────────────────────────────────────────
  if (
    pathname.startsWith('/my-orders') ||
    pathname.startsWith('/profile')   ||
    pathname.startsWith('/payment')
  ) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/register',
    '/admin/:path*',
    '/agent/:path*',
    '/my-orders/:path*',
    '/profile/:path*',
    '/payment/:path*',
  ],
};
