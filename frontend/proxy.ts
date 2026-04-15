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

  // Always land on login when visiting root.
  // Authenticated users will then be routed client-side to /dashboard or
  // /first-login-password after session restore.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
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
  // Only a real refresh token should be treated as authenticated.
  // The hint cookie can be stale and must not cause redirects from / to auth-only flows.
  const hasRefreshToken = Boolean(refreshToken);
  const isLikelyAuthenticated = Boolean(refreshToken || authHint);

  // If trying to access protected route without refresh token, redirect to login
  if (!isPublicPath && !isLikelyAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user tries to access login page directly, redirect to dashboard.
  if (pathname === '/login' && hasRefreshToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
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
