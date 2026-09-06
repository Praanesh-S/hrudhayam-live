import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionToken = request.cookies.get('hl_session')?.value;

  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/pass/') ||
    pathname.startsWith('/api/checkin/verify') ||
    pathname.startsWith('/api/manifest') ||
    pathname.startsWith('/api/digest');

  const isProtectedRoute =
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/sell') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/guests') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/checkin') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/clubs') ||
    pathname.startsWith('/leaderboard') ||
    pathname.startsWith('/payments');

  // If user visits root '/', redirect to dashboard or login
  if (pathname === '/') {
    const target = sessionToken ? '/dashboard' : '/login';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // If unauthenticated user tries to access protected route
  if (!sessionToken && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // If authenticated user visits login, send to dashboard
  if (sessionToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Static assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
