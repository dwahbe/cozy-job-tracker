'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { FeedbackButton } from './FeedbackButton';

import type { Session } from 'next-auth';

interface NavDropdownPanelProps {
  active: 'about' | 'user';
  panelPos: { right: number; width: number };
  session: Session | null;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function NavDropdownPanel({
  active,
  panelPos,
  session,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: NavDropdownPanelProps) {
  return (
    <div
      className="nav-dropdown-panel card card-solid shadow-lg border border-foreground/10 py-1 z-50 rounded-xl"
      style={{
        position: 'absolute',
        top: '100%',
        marginTop: 4,
        right: panelPos.right,
        width: panelPos.width,
        transition: 'right 200ms ease, width 200ms ease',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            opacity: active === 'about' ? 1 : 0,
            position: active === 'about' ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transition: 'opacity 150ms ease',
            pointerEvents: active === 'about' ? 'auto' : 'none',
          }}
        >
          <Link
            href="/changelog"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 text-sm no-underline hover:bg-foreground/5 transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            <svg
              className="w-4 h-4 shrink-0 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
              />
            </svg>
            Changelog
          </Link>
          <FeedbackButton className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-foreground/5 transition-colors cursor-pointer">
            <svg
              className="w-4 h-4 shrink-0 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Send feedback
          </FeedbackButton>
        </div>

        <div
          style={{
            opacity: active === 'user' ? 1 : 0,
            position: active === 'user' ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transition: 'opacity 150ms ease',
            pointerEvents: active === 'user' ? 'auto' : 'none',
          }}
        >
          {session?.user?.email && (
            <div className="px-3 py-2 border-b border-foreground/10">
              <p className="text-sm font-medium truncate">{session.user.name || 'No name set'}</p>
              <p className="text-xs muted truncate">{session.user.email}</p>
            </div>
          )}
          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 text-sm no-underline hover:bg-foreground/5 transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            <svg
              className="w-4 h-4 shrink-0 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-foreground/5 transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4 shrink-0 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
