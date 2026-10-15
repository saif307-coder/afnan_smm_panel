import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, isValidAdminToken } from '@/lib/auth';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAuthenticated = isValidAdminToken(token);

  // 0. Root path redirect
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  // 0b. /login alias redirect
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  // 1. If user is on /admin/login
  if (pathname === '/admin/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return NextResponse.next();
  }

  // 2. Protect /admin pages
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. Protect /api/admin endpoints
  if (pathname.startsWith('/api/admin')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/api/admin/:path*'],
};
