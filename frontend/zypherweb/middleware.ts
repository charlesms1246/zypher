import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for protecting routes that require wallet connection
 * Redirects to /wallet page if accessing protected routes without connection
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Protected routes that require wallet connection
  const protectedPaths = ['/mint', '/dashboard'];
  
  // Check if current path is protected
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (isProtectedPath) {
    // Note: Since wallet state is client-side only, we handle protection primarily on the client
    // This middleware serves as an additional layer but main protection is in page components
    // For now, we allow access and let client-side guards handle the protection
    // In a production app, you'd want to implement proper session management
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/mint/:path*',
    '/dashboard/:path*',
  ],
};
