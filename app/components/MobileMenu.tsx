'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { FeedbackButton } from './FeedbackButton';

const CHROME_EXT_URL =
  'https://chromewebstore.google.com/detail/cozy-job-tracker/jnkjaboanaihkoiidmpjolldkgkbpllm';

export function MobileMenu() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [openAtPathname, setOpenAtPathname] = useState<string | null>(null);
  const open = openAtPathname === pathname;
  const ref = useRef<HTMLDivElement>(null);
  const isLoaded = status !== 'loading';
  const isLoggedIn = isLoaded && !!session?.user;

  const toggleMenu = () => setOpenAtPathname(open ? null : pathname);
  const closeMenu = () => setOpenAtPathname(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div className="sm:hidden relative" ref={ref}>
      <button onClick={toggleMenu} aria-expanded={open} aria-label="Menu" className="hamburger-btn">
        <span className={`hamburger-line ${open ? 'hamburger-line-1-open' : ''}`} />
        <span className={`hamburger-line ${open ? 'hamburger-line-2-open' : ''}`} />
        <span className={`hamburger-line ${open ? 'hamburger-line-3-open' : ''}`} />
      </button>

      {open && (
        <div className="mobile-menu-panel absolute right-0 top-full mt-1 w-64 card card-solid shadow-lg border border-foreground/10 py-1 z-50">
          {isLoggedIn && session?.user?.email && (
            <div className="px-3 py-2 border-b border-foreground/10">
              <p className="text-sm font-medium truncate">{session.user.name || 'No name set'}</p>
              <p className="text-xs muted truncate">{session.user.email}</p>
            </div>
          )}

          <a
            href={CHROME_EXT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-menu-item"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48">
              <defs>
                <linearGradient
                  id="mobile-chrome-a"
                  x1="3.2173"
                  y1="15"
                  x2="44.7812"
                  y2="15"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#d93025" />
                  <stop offset="1" stopColor="#ea4335" />
                </linearGradient>
                <linearGradient
                  id="mobile-chrome-b"
                  x1="20.7219"
                  y1="47.6791"
                  x2="41.5039"
                  y2="11.6837"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#fcc934" />
                  <stop offset="1" stopColor="#fbbc04" />
                </linearGradient>
                <linearGradient
                  id="mobile-chrome-c"
                  x1="26.5981"
                  y1="46.5015"
                  x2="5.8161"
                  y2="10.506"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#1e8e3e" />
                  <stop offset="1" stopColor="#34a853" />
                </linearGradient>
              </defs>
              <circle cx="24" cy="23.9947" r="12" fill="#fff" />
              <path
                d="M24,12H44.7812a23.9939,23.9939,0,0,0-41.5639.0029L13.6079,30l.0093-.0024A11.9852,11.9852,0,0,1,24,12Z"
                fill="url(#mobile-chrome-a)"
              />
              <circle cx="24" cy="24" r="9.5" fill="#1a73e8" />
              <path
                d="M34.3913,30.0029,24.0007,48A23.994,23.994,0,0,0,44.78,12.0031H23.9989l-.0025.0093A11.985,11.985,0,0,1,34.3913,30.0029Z"
                fill="url(#mobile-chrome-b)"
              />
              <path
                d="M13.6086,30.0031,3.218,12.006A23.994,23.994,0,0,0,24.0025,48L34.3931,30.0029l-.0067-.0068a11.9852,11.9852,0,0,1-20.7778.007Z"
                fill="url(#mobile-chrome-c)"
              />
            </svg>
            Chrome extension
          </a>

          <Link href="/changelog" onClick={closeMenu} className="mobile-menu-item">
            <svg className="w-4 h-4 muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
              />
            </svg>
            Changelog
          </Link>

          <FeedbackButton className="mobile-menu-item w-full text-left cursor-pointer">
            <svg className="w-4 h-4 muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Send feedback
          </FeedbackButton>

          {isLoaded && (
            <>
              <div className="border-t border-foreground/10 my-1" />
              {isLoggedIn ? (
                <>
                  <Link href="/settings" onClick={closeMenu} className="mobile-menu-item">
                    <svg
                      className="w-4 h-4 muted"
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
                    className="mobile-menu-item w-full text-left cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 muted"
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
                </>
              ) : (
                <Link href="/login" onClick={closeMenu} className="mobile-menu-item">
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
