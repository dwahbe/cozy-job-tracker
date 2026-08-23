import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { checkLimit, getClientIp } from '@/lib/ratelimit';

// Only the paths in `config.matcher` reach this proxy: the protected app routes, /login and
// the sign-in endpoint. Protected routes get a cheap session-cookie presence check here; the
// real validation happens in each page via verifySession() (lib/dal.ts), which also redirects
// to /login.
const SESSION_COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token'];

/** Same-origin, path-only URLs (rejects protocol-relative `//host` and backslash tricks). */
function isSafeCallbackUrl(url: string | null): url is string {
  return !!url && /^\/(?![/\\])/.test(url);
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // POST /api/auth/signin/<provider> sends a magic-link email per request, so it is throttled
  // per client IP before NextAuth sees it. GETs on the same path are harmless.
  if (pathname.startsWith('/api/auth/signin')) {
    if (request.method === 'POST') {
      const verdict = await checkLimit('signin', getClientIp(request));
      if (!verdict.ok) {
        // next-auth/react's signIn() reads `url` from every response; this one carries the
        // error code back to the login page.
        return NextResponse.json(
          {
            error: verdict.message,
            url: new URL('/login?error=RateLimited', request.url).toString(),
          },
          { status: 429, headers: { 'Retry-After': String(verdict.retryAfter) } }
        );
      }
    }
    return NextResponse.next();
  }

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
  matcher: [
    '/board/:path*',
    '/network/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/login',
    '/api/auth/signin/:path*',
  ],
};
