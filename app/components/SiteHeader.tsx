'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserDropdown } from './UserDropdown';
import { FeedbackButton } from './FeedbackButton';

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;

  return (
    <header className="topbar">
      <div className="container-app h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="brand">
            cozy job tracker
          </Link>
          {isLoggedIn && (
            <nav className="flex items-center gap-1">
              <Link
                href="/board"
                className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                  pathname.startsWith('/board')
                    ? 'font-semibold bg-foreground/10'
                    : 'muted hover:bg-foreground/5'
                }`}
              >
                Board
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/changelog" className="topbar-whats-new hidden sm:inline-flex">
            What&apos;s new
          </Link>
          <span className="hidden sm:inline">
            <FeedbackButton className="topbar-whats-new" />
          </span>
          {status !== 'loading' && (
            <>
              {isLoggedIn ? (
                <UserDropdown />
              ) : (
                <Link
                  href="/login"
                  className="text-sm font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
