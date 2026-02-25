import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE = 'https://cozyjobtracker.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export function GET() {
  return NextResponse.json(
    {
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
    },
    { headers: CORS_HEADERS }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
