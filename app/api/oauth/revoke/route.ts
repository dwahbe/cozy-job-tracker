import { revokeToken } from '@/lib/oauth';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const token = params.get('token');

    if (token) {
      await revokeToken(token);
    }

    return new Response(null, { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    console.error('[oauth/revoke]', e);
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
