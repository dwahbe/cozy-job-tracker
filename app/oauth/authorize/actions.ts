'use server';

import { auth } from '@/auth';
import { generateCode, parseScopes, storeAuthCode, validateRedirectUri } from '@/lib/oauth';

interface ApproveInput {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope: string;
}

export type ApproveResult = { url: string } | { error: string };

/**
 * Issue an authorization code for the signed-in user. Returns the redirect URL or an error
 * message (returned, not thrown — thrown server-action errors are masked in production).
 */
export async function approveConsent(input: ApproveInput): Promise<ApproveResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Your session has expired — sign in again and retry.' };
  }

  const { unsupported } = parseScopes(input.scope);
  if (unsupported.length > 0) {
    return { error: `Unsupported scope: ${unsupported.join(' ')}` };
  }

  const { valid } = await validateRedirectUri(input.clientId, input.redirectUri);
  if (!valid) {
    return { error: 'The redirect URI is not allowed for this client.' };
  }

  let url: URL;
  try {
    url = new URL(input.redirectUri);
  } catch {
    return { error: 'The redirect URI is not a valid URL.' };
  }

  const code = generateCode();
  try {
    await storeAuthCode(code, {
      userId: session.user.id,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope,
    });
  } catch (error) {
    console.error('[oauth/authorize] could not store auth code', error);
    return { error: 'Could not complete the connection — please try again.' };
  }

  url.searchParams.set('code', code);
  if (input.state) url.searchParams.set('state', input.state);

  return { url: url.toString() };
}
