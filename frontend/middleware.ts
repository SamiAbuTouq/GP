import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for server-side route protection
 * 
 * Checks for the presence of refresh_token cookie to determine if user is authenticated.
 * This provides a first layer of protection at the edge/server level.
 * 
 * Note: The actual token validation happens on the backend.
 * The cookie presence check here is a quick pre-check to avoid unnecessary
 * client-side loading for clearly unauthenticated users.
 */

// Public routes that don't require authentication
const publicPaths = ['/', '/login', '/forgot-password', '/reset-password', '/help'];

// Static assets and API routes to skip
const skipPaths = ['/_next', '/api', '/images', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets and API routes
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if the current path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Get the refresh token from cookies
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const hasRefreshToken = !!refreshToken;

  // If trying to access protected route without refresh token, redirect to login
  if (!isPublicPath && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url);
    // Optionally store the intended destination
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user tries to access public auth pages, redirect to dashboard
  if ((pathname === '/' || pathname === '/login') && hasRefreshToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If unauthenticated user visits root, redirect to login
  if (pathname === '/' && !hasRefreshToken) {
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
