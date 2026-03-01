import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

const protectedPrefixes = ['/board', '/settings', '/admin'];
const authRoutes = ['/login'];

const BASE = 'https://cozyjobtracker.com';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const PROTECTED_RESOURCE_METADATA = {
  resource: `${BASE}/api/mcp`,
  authorization_servers: [BASE],
  scopes_supported: ['board:read', 'board:write'],
};

const AUTHORIZATION_SERVER_METADATA = {
  issuer: BASE,
  authorization_endpoint: `${BASE}/oauth/authorize`,
  token_endpoint: `${BASE}/api/oauth/token`,
  revocation_endpoint: `${BASE}/api/oauth/revoke`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  client_id_metadata_document_supported: true,
  scopes_supported: ['board:read', 'board:write'],
};

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === '/.well-known/oauth-protected-resource') {
    if (request.method === 'OPTIONS')
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    return NextResponse.json(PROTECTED_RESOURCE_METADATA, { headers: CORS_HEADERS });
  }

  if (path === '/.well-known/oauth-authorization-server') {
    if (request.method === 'OPTIONS')
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    return NextResponse.json(AUTHORIZATION_SERVER_METADATA, { headers: CORS_HEADERS });
  }

  const isProtected = protectedPrefixes.some((prefix) => path.startsWith(prefix));
  const isAuthRoute = authRoutes.some((route) => path.startsWith(route));

  const session = await auth();

  if (isProtected && !session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

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
