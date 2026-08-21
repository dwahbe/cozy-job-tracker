import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

// Only the paths in `config.matcher` reach this proxy: the protected app routes plus /login.
// Protected routes get a cheap session-cookie presence check here; the real validation
// happens in each page via verifySession() (lib/dal.ts), which also redirects to /login.
const SESSION_COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token'];

/** Same-origin, path-only URLs (rejects protocol-relative `//host` and backslash tricks). */
function isSafeCallbackUrl(url: string | null): url is string {
  return !!url && /^\/(?![/\\])/.test(url);
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname.startsWith('/login');

  if (!isLoginPage) {
    const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname + search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // /login: send signed-in users on to where they were headed (defaults to /board).
  const session = await auth();
  if (session?.user) {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
    return NextResponse.redirect(
      new URL(isSafeCallbackUrl(callbackUrl) ? callbackUrl : '/board', request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/board/:path*', '/network/:path*', '/settings/:path*', '/admin/:path*', '/login'],
};
