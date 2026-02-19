'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const MIN_REFRESH_INTERVAL = 5000;

export function RefreshOnFocus() {
  const router = useRouter();
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefresh.current >= MIN_REFRESH_INTERVAL) {
          lastRefresh.current = now;
          router.refresh();
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [router]);

  return null;
}
