'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LegacyBoardAccess } from '@/app/components/LegacyBoardAccess';

export default function BoardNotFound() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="page">
      <div className="container-app max-w-md">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold mb-3">
            we can&apos;t find the board at{' '}
            <span className="font-mono text-lg break-all">{pathname}</span>
          </h1>
          <p className="muted mb-6">
            double-check the name for typos, or start fresh with an account.
          </p>
          <Link href="/login" className="btn btn-primary inline-block mb-6">
            Start tracking
          </Link>
          <div className="border-t pt-5">
            <p className="text-sm muted mb-2">Try a different board name:</p>
            <LegacyBoardAccess />
          </div>
        </div>
      </div>
    </main>
  );
}
