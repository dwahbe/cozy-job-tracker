import { NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_TTL,
  consumeAuthCode,
  consumeRefreshToken,
  generateToken,
  storeAccessToken,
  storeRefreshToken,
  verifyPkce,
} from '@/lib/oauth';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: CORS_HEADERS }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const grantType = params.get('grant_type');

    console.log('[oauth/token] grant_type=%s client_id=%s', grantType, params.get('client_id'));

    if (grantType === 'authorization_code') {
      return handleAuthorizationCode(params);
    }

    if (grantType === 'refresh_token') {
      return handleRefreshToken(params);
    }

    return oauthError('unsupported_grant_type', `Unsupported grant_type: ${grantType}`);
  } catch (e) {
    console.error('[oauth/token]', e);
    return oauthError('server_error', String(e), 500);
  }
}

async function handleAuthorizationCode(params: URLSearchParams) {
  const code = params.get('code');
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const codeVerifier = params.get('code_verifier');

  if (!code || !clientId || !redirectUri || !codeVerifier) {
    console.log(
      '[oauth/token] missing params: code=%s clientId=%s uri=%s verifier=%s',
      !!code,
      !!clientId,
      !!redirectUri,
      !!codeVerifier
    );
    return oauthError('invalid_request', 'Missing required parameters.');
  }

  const codeData = await consumeAuthCode(code);
  if (!codeData) {
    console.log('[oauth/token] auth code invalid or expired');
    return oauthError('invalid_grant', 'Authorization code is invalid or expired.');
  }

  if (codeData.clientId !== clientId) {
    console.log(
      '[oauth/token] client_id mismatch: stored=%s received=%s',
      codeData.clientId,
      clientId
    );
    return oauthError('invalid_grant', 'client_id does not match.');
  }

  if (codeData.redirectUri !== redirectUri) {
    console.log(
      '[oauth/token] redirect_uri mismatch: stored=%s received=%s',
      codeData.redirectUri,
      redirectUri
    );
    return oauthError('invalid_grant', 'redirect_uri does not match.');
  }

  if (!verifyPkce(codeVerifier, codeData.codeChallenge)) {
    console.log('[oauth/token] PKCE failed');
    return oauthError('invalid_grant', 'PKCE verification failed.');
  }

  console.log('[oauth/token] success, issuing tokens for user=%s', codeData.userId);
  return issueTokens(codeData.userId, codeData.clientId, codeData.scope);
}

async function handleRefreshToken(params: URLSearchParams) {
  const refreshToken = params.get('refresh_token');
  const clientId = params.get('client_id');

  if (!refreshToken || !clientId) {
    return oauthError('invalid_request', 'Missing required parameters.');
  }

  const tokenData = await consumeRefreshToken(refreshToken);
  if (!tokenData) {
    return oauthError('invalid_grant', 'Refresh token is invalid or expired.');
  }

  if (tokenData.clientId !== clientId) {
    return oauthError('invalid_grant', 'client_id does not match.');
  }

  return issueTokens(tokenData.userId, tokenData.clientId, tokenData.scope);
}

async function issueTokens(userId: string, clientId: string, scope: string) {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const tokenPayload = { userId, clientId, scope };

  await Promise.all([
    storeAccessToken(accessToken, tokenPayload),
    storeRefreshToken(refreshToken, tokenPayload),
  ]);

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL,
      refresh_token: refreshToken,
      scope,
    },
    { headers: CORS_HEADERS }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
