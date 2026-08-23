'use client';

import { useEffect, useState } from 'react';

const TOAST_EVENT = 'cozy-toast';
const TOAST_MS = 5000;

interface ToastDetail {
  id: number;
  message: string;
  kind: 'error' | 'info';
}

/** Show a short-lived message at the bottom of the viewport. Safe to call from any client code. */
export function showToast(message: string, kind: ToastDetail['kind'] = 'error') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, {
      detail: { id: Date.now() + Math.random(), message, kind },
    })
  );
}

/** Mounted once in the root layout; renders whatever showToast() has been called with. */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastDetail[]>([]);

  useEffect(() => {
    const timers = new Set<number>();
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      setToasts((prev) => [...prev.slice(-2), detail]);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, TOAST_MS);
      timers.add(timer);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[10000] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border bg-surface-solid px-3.5 py-2.5 text-sm shadow-lg ${
            toast.kind === 'error' ? 'border-danger/40 text-danger' : 'border-border'
          }`}
        >
          <span className="min-w-0">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M3 3l6 6M9 3l-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
