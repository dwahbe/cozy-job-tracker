'use client';

import { useState } from 'react';
import { approveConsent } from './actions';

interface ConsentFormProps {
  clientName: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope: string;
  userEmail: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ConsentForm({
  clientName,
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scope,
  userEmail,
}: ConsentFormProps) {
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = clientName.startsWith('https://')
    ? clientName.replace(/^https?:\/\//, '')
    : clientName;
  const redirectHost = hostOf(redirectUri);
  const scopes = scope.split(/\s+/).filter(Boolean);

  async function handleAllow() {
    setLoading(true);
    setError(null);
    try {
      const result = await approveConsent({
        clientId,
        redirectUri,
        codeChallenge,
        state,
        scope,
      });
      if ('error' in result) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setRedirecting(true);
      window.location.href = result.url;
    } catch {
      setError('Something went wrong — please try again.');
      setLoading(false);
    }
  }

  function handleDeny() {
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  }

  if (redirecting) {
    return (
      <main className="page">
        <div className="container-app max-w-md">
          <div className="card p-8 text-center" role="status">
            <h1 className="text-2xl font-bold mb-2">Redirecting…</h1>
            <p className="muted">
              Sending you back to <strong>{redirectHost}</strong>. If nothing happens, you can close
              this tab.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container-app max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-2">Connect to {displayName}</h1>
          <p className="muted mb-6">
            <strong>{displayName}</strong> wants to access your cozy job tracker board.
          </p>

          <div className="mb-6 text-sm space-y-1.5">
            <p className="font-medium mb-2">This will allow it to:</p>
            <ul className="list-disc pl-5 space-y-1 muted">
              {scopes.includes('board:read') && <li>View your jobs, board and network</li>}
              {scopes.includes('board:write') && <li>Add, update, and delete jobs and people</li>}
            </ul>
          </div>

          <p className="text-sm muted mb-2">
            Signed in as <strong>{userEmail}</strong>
          </p>
          <p className="text-sm muted mb-6">
            You&apos;ll be sent back to <strong>{redirectHost}</strong> after you allow access.
          </p>

          {error && (
            <p className="text-sm text-red-600 mb-4" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleAllow}
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Connecting...' : 'Allow'}
            </button>
            <button type="button" onClick={handleDeny} disabled={loading} className="btn flex-1">
              Deny
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
