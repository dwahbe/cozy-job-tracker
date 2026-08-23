'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function TrashError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page">
      <div className="container-app max-w-5xl text-center py-20">
        <p className="text-lg font-medium mb-2">Something went wrong loading trash</p>
        <p className="text-sm muted mb-6">This is unexpected — try again, or head back home.</p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
