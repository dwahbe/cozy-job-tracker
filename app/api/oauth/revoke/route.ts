import { revokeToken } from '@/lib/oauth';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const token = params.get('token');

  if (token) {
    await revokeToken(token);
  }

  // Per RFC 7009, always return 200 regardless of whether the token existed
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
