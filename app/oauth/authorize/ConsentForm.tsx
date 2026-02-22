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

  const displayName = clientName.startsWith('https://')
    ? clientName.replace(/^https?:\/\//, '')
    : clientName;

  async function handleAllow() {
    setLoading(true);
    try {
      await approveConsent({ clientId, redirectUri, codeChallenge, state, scope });
    } catch {
      setLoading(false);
    }
  }

  function handleDeny() {
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
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
              {scope.includes('board:read') && <li>View your jobs and board</li>}
              {scope.includes('board:write') && <li>Add, update, and delete jobs</li>}
            </ul>
          </div>

          <p className="text-sm muted mb-6">
            Signed in as <strong>{userEmail}</strong>
          </p>

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
