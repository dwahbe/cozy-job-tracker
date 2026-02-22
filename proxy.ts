import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

// Routes that require authentication
const protectedPrefixes = ['/board', '/settings'];

// Routes that should redirect to /board if already authenticated
const authRoutes = ['/login'];

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isProtected = protectedPrefixes.some((prefix) => path.startsWith(prefix));
  const isAuthRoute = authRoutes.some((route) => path.startsWith(route));

  // Get session from Auth.js
  const session = await auth();

  // Redirect unauthenticated users away from protected routes
  if (isProtected && !session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect authenticated users away from login to their board
  // Exception: if callbackUrl points to /oauth, honor the OAuth flow instead
  if (isAuthRoute && session?.user) {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
    if (callbackUrl?.startsWith('/oauth')) {
      return NextResponse.redirect(new URL(callbackUrl, request.url));
    }
    return NextResponse.redirect(new URL('/board', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
