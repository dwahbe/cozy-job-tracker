import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export function GET() {
  return NextResponse.json(
    {
      resource: 'https://cozyjobtracker.com/api/mcp',
      authorization_servers: ['https://cozyjobtracker.com'],
      scopes_supported: ['board:read', 'board:write'],
    },
    { headers: CORS_HEADERS }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
