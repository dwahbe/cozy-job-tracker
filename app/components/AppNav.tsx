'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserDropdown } from './UserDropdown';

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div className="container-app h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="brand">
            cozy job tracker
          </Link>
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
            <Link
              href="/trash"
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                pathname.startsWith('/trash')
                  ? 'font-semibold bg-foreground/10'
                  : 'muted hover:bg-foreground/5'
              }`}
            >
              Trash
            </Link>
          </nav>
        </div>
        <UserDropdown />
      </div>
    </header>
  );
}
