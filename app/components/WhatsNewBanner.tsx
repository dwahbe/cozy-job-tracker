'use client';

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { changelog } from '../changelog-data';

const STORAGE_KEY = 'cozy-changelog-dismissed';

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

export function WhatsNewBanner() {
  const latest = changelog[0];
  const dismissKey = latest?.date ?? '';

  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const visible = !!dismissKey && dismissed !== dismissKey;

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, dismissKey);
      // Force re-render by dispatching a storage event
      window.dispatchEvent(new Event('storage'));
    } catch {
      // localStorage unavailable
    }
  }, [dismissKey]);

  if (!visible || !latest) return null;

  return (
    <div className="whats-new-banner">
      <div className="container-app whats-new-banner-inner">
        <Link href="/changelog" className="whats-new-banner-content">
          <span className="whats-new-badge">new</span>
          <span className="whats-new-text">
            {latest.emoji} {latest.title}
          </span>
          <span className="whats-new-link">See what&apos;s new →</span>
        </Link>
        <button onClick={handleDismiss} className="whats-new-close" aria-label="Dismiss">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
