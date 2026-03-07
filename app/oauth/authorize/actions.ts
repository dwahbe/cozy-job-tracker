'use server';

import { auth } from '@/auth';
import { generateCode, storeAuthCode, validateRedirectUri } from '@/lib/oauth';

interface ApproveInput {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope: string;
}

export async function approveConsent(input: ApproveInput): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  const { valid } = await validateRedirectUri(input.clientId, input.redirectUri);
  if (!valid) {
    throw new Error('Invalid redirect URI');
  }

  const code = generateCode();
  await storeAuthCode(code, {
    userId: session.user.id,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scope: input.scope,
  });

  const url = new URL(input.redirectUri);
  url.searchParams.set('code', code);
  if (input.state) url.searchParams.set('state', input.state);

  return url.toString();
}
