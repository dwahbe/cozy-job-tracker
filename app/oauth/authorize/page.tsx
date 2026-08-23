import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { DEFAULT_SCOPE, SUPPORTED_SCOPES, parseScopes, validateRedirectUri } from '@/lib/oauth';
import { ConsentForm } from './ConsentForm';

interface OAuthParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}

function ErrorCard({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="page">
      <div className="container-app max-w-md">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold mb-3">{title}</h1>
          <p className="muted">{detail}</p>
        </div>
      </div>
    </main>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<OAuthParams>;
}) {
  const params = await searchParams;
  const { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state } =
    params;
  // Scopes default to everything we offer; anything outside scopes_supported is refused up front.
  const { scopes, unsupported } = parseScopes(params.scope?.trim() ? params.scope : DEFAULT_SCOPE);
  const scope = scopes.join(' ');

  if (response_type !== 'code') {
    return <ErrorCard title="Unsupported request" detail="Only response_type=code is supported." />;
  }

  if (!client_id || !redirect_uri || !code_challenge) {
    return (
      <ErrorCard
        title="Invalid request"
        detail="Missing required parameters (client_id, redirect_uri, or code_challenge)."
      />
    );
  }

  if (code_challenge_method !== 'S256') {
    return (
      <ErrorCard
        title="Unsupported challenge method"
        detail="Only S256 code challenge method is supported."
      />
    );
  }

  if (unsupported.length > 0) {
    return (
      <ErrorCard
        title="Unsupported scope"
        detail={`This app asked for "${unsupported.join(' ')}", which cozy job tracker doesn't offer. Supported scopes: ${SUPPORTED_SCOPES.join(', ')}.`}
      />
    );
  }

  const { valid, clientName } = await validateRedirectUri(client_id, redirect_uri);
  if (!valid) {
    return (
      <ErrorCard
        title="Invalid redirect"
        detail="The redirect URI is not allowed for this client."
      />
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined)
    ) as Record<string, string>;
    const qs = new URLSearchParams(filtered).toString();
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }

  return (
    <ConsentForm
      clientName={clientName}
      clientId={client_id}
      redirectUri={redirect_uri}
      codeChallenge={code_challenge}
      state={state || ''}
      scope={scope}
      userEmail={session.user.email || ''}
    />
  );
}

export function generateMetadata() {
  return { title: 'Authorize — cozy job tracker' };
}
