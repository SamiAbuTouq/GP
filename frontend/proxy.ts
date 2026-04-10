import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy for server-side route protection.
 *
 * Checks for refresh_token cookie presence to determine whether a user is
 * likely authenticated. Actual token validation still happens on the backend.
 */

// Public routes that don't require authentication
const publicPaths = ["/", "/login", "/forgot-password", "/reset-password", "/help"];

// Static assets and API routes to skip
const skipPaths = ['/_next', '/api', '/images', '/favicon.ico'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip proxy for static assets and API routes
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if the current path is public.
  // Root must be exact-match; other entries allow nested paths.
  const isPublicPath = publicPaths.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );

  // Authentication hint cookies:
  // - refresh_token: available when auth cookie is set on this same domain
  // - uts_auth_hint: lightweight client cookie set on login/refresh, cleared on logout
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const authHint = request.cookies.get('uts_auth_hint')?.value;
  const isLikelyAuthenticated = Boolean(refreshToken || authHint);

  // If trying to access protected route without refresh token, redirect to login
  if (!isPublicPath && !isLikelyAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user tries to access public auth pages, redirect to dashboard
  if ((pathname === '/' || pathname === '/login') && isLikelyAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If unauthenticated user visits root, redirect to login
  if (pathname === '/' && !isLikelyAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
};
