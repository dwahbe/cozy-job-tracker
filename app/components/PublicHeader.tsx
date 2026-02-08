'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export function PublicHeader() {
  const { data: session } = useSession();

  return (
    <header className="topbar">
      <div className="container-app h-14 flex items-center justify-between">
        <Link href="/" className="brand">
          cozy job tracker
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/changelog" className="topbar-whats-new hidden sm:inline-flex">
            what&apos;s new
          </Link>
          {session?.user ? (
            <Link
              href="/board"
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              my board
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
