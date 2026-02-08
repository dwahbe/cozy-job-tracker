'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export function MigrationBanner({ slug }: { slug: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  async function handleClaim() {
    setClaiming(true);
    setError('');

    try {
      const res = await fetch('/api/claim-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/board');
      } else {
        setError(data.error || 'Failed to migrate board');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="card p-4 mb-6 border-2 border-foreground/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1">
          <p className="font-semibold text-sm">Migrate to an account</p>
          <p className="text-sm muted">
            Link your email to keep your board safe. No password needed.
          </p>
        </div>
        {session?.user ? (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="btn btn-primary text-sm whitespace-nowrap"
          >
            {claiming ? 'Migrating...' : 'Migrate this board'}
          </button>
        ) : (
          <button
            onClick={() => signIn(undefined, { callbackUrl: `/b/${slug}` })}
            className="btn btn-primary text-sm whitespace-nowrap"
          >
            Sign in to migrate
          </button>
        )}
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
