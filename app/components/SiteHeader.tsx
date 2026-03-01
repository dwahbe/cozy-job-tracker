'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MobileMenu } from './MobileMenu';
import { NavDropdownPanel } from './NavDropdownPanel';

const CHROME_EXT_URL =
  'https://chromewebstore.google.com/detail/cozy-job-tracker/jnkjaboanaihkoiidmpjolldkgkbpllm';

type DropdownId = 'about' | 'user';

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;

  const [activeDropdown, setActiveDropdown] = useState<DropdownId | null>(null);
  const [panelPos, setPanelPos] = useState({ right: 0, width: 192 });

  const containerRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const openDropdown = useCallback((which: DropdownId) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const trigger = which === 'about' ? aboutRef.current : userRef.current;
    const container = containerRef.current;
    if (trigger && container) {
      const triggerRect = trigger.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setPanelPos({
        right: containerRect.right - triggerRect.right,
        width: which === 'about' ? 192 : 224,
      });
    }
    setActiveDropdown(which);
  }, []);

  const closeDropdown = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveDropdown(null);
  }, []);

  const scheduleClose = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActiveDropdown(null), 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    if (!activeDropdown) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDropdown();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [activeDropdown, closeDropdown]);

  const displayName = session?.user?.name || session?.user?.email || 'Account';
  const isAppPage = /^\/(board|network|settings|trash)(\/|$)/.test(pathname);

  return (
    <header className={`topbar${isAppPage ? '' : ' topbar-sticky'}`}>
      <nav className="topbar-pill">
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
                Job board
              </Link>
              <Link
                href="/network"
                className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                  pathname.startsWith('/network')
                    ? 'font-semibold bg-foreground/10'
                    : 'muted hover:bg-foreground/5'
                }`}
              >
                Network
              </Link>
            </nav>
          )}
        </div>

        <div ref={containerRef} className="hidden sm:flex items-center gap-3 relative">
          <a
            href={CHROME_EXT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="topbar-whats-new flex items-center gap-1.5 no-underline"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48">
              <defs>
                <linearGradient
                  id="chrome-a"
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
                  id="chrome-b"
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
                  id="chrome-c"
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
                fill="url(#chrome-a)"
              />
              <circle cx="24" cy="24" r="9.5" fill="#1a73e8" />
              <path
                d="M34.3913,30.0029,24.0007,48A23.994,23.994,0,0,0,44.78,12.0031H23.9989l-.0025.0093A11.985,11.985,0,0,1,34.3913,30.0029Z"
                fill="url(#chrome-b)"
              />
              <path
                d="M13.6086,30.0031,3.218,12.006A23.994,23.994,0,0,0,24.0025,48L34.3931,30.0029l-.0067-.0068a11.9852,11.9852,0,0,1-20.7778.007Z"
                fill="url(#chrome-c)"
              />
            </svg>
            Chrome extension
          </a>

          <div
            ref={aboutRef}
            onMouseEnter={() => openDropdown('about')}
            onMouseLeave={scheduleClose}
          >
            <button
              onClick={() => (activeDropdown === 'about' ? closeDropdown() : openDropdown('about'))}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md hover:bg-foreground/5 transition-colors cursor-pointer"
              aria-expanded={activeDropdown === 'about'}
            >
              About
              <svg
                className={`w-3 h-3 transition-transform ${activeDropdown === 'about' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {status !== 'loading' && (
            <>
              {isLoggedIn ? (
                <div
                  ref={userRef}
                  onMouseEnter={() => openDropdown('user')}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    onClick={() =>
                      activeDropdown === 'user' ? closeDropdown() : openDropdown('user')
                    }
                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md hover:bg-foreground/5 transition-colors cursor-pointer"
                  >
                    <span
                      className="max-w-[120px] sm:max-w-[180px] truncate"
                      suppressHydrationWarning
                    >
                      {displayName}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'user' ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="btn btn-primary btn-sm"
                >
                  Sign in
                </Link>
              )}
            </>
          )}

          {activeDropdown && (
            <NavDropdownPanel
              active={activeDropdown}
              panelPos={panelPos}
              session={session}
              onClose={closeDropdown}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            />
          )}
        </div>

        <MobileMenu />
      </nav>
    </header>
  );
}
