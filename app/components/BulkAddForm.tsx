'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ValidatedJob } from '@/lib/validateExtraction';

interface BulkAddFormProps {
  slug: string;
}

type UrlStatus = 'pending' | 'parsing' | 'success' | 'failed';

interface UrlEntry {
  url: string;
  status: UrlStatus;
  job?: ValidatedJob;
  error?: string;
}

const MAX_URLS = 50;
const CONCURRENCY = 3;

function extractUrls(text: string): string[] {
  const lines = text.split(/[\n,]+/);
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const url = new URL(trimmed);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && !seen.has(url.href)) {
        seen.add(url.href);
        urls.push(url.href);
      }
    } catch {
      // not a valid URL, skip
    }
  }

  return urls;
}

export function BulkAddForm({ slug }: BulkAddFormProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<UrlEntry[]>([]);
  const [phase, setPhase] = useState<'input' | 'parsing' | 'review' | 'adding'>('input');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const urls = extractUrls(input);
  const urlCount = urls.length;
  const overLimit = urlCount > MAX_URLS;

  const successEntries = entries.filter((e) => e.status === 'success' && e.job);
  const failedEntries = entries.filter((e) => e.status === 'failed');
  const parsedCount = entries.filter((e) => e.status === 'success' || e.status === 'failed').length;

  const handleParse = async () => {
    if (urlCount === 0 || overLimit) return;

    abortRef.current = false;
    setError(null);

    const initial: UrlEntry[] = urls.map((url) => ({ url, status: 'pending' }));
    setEntries(initial);
    setPhase('parsing');

    // Process URLs with concurrency limit
    let nextIndex = 0;

    const processNext = async (): Promise<void> => {
      while (nextIndex < initial.length) {
        if (abortRef.current) return;

        const idx = nextIndex++;

        // Mark as parsing
        setEntries((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'parsing' };
          return next;
        });

        try {
          const response = await fetch('/api/parse-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: initial[idx].url }),
          });

          if (abortRef.current) return;

          const data = await response.json();

          if (!response.ok) {
            setEntries((prev) => {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                status: 'failed',
                error: data.error || 'Failed to parse',
              };
              return next;
            });
          } else {
            setEntries((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], status: 'success', job: data.job };
              return next;
            });
          }
        } catch {
          if (abortRef.current) return;
          setEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: 'failed', error: 'Network error' };
            return next;
          });
        }
      }
    };

    // Launch concurrent workers
    const workers = Array.from({ length: Math.min(CONCURRENCY, initial.length) }, () =>
      processNext()
    );
    await Promise.all(workers);

    if (!abortRef.current) {
      setPhase('review');
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
    setPhase('review');
  };

  const handleAddAll = async () => {
    if (successEntries.length === 0) return;

    setPhase('adding');
    setError(null);

    try {
      const response = await fetch('/api/bulk-add-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          jobs: successEntries.map((e) => e.job),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add jobs');
        setPhase('review');
        return;
      }

      // Fire confetti
      try {
        const confetti = (await import('canvas-confetti')).default;
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      } catch {
        // confetti is optional
      }

      // Reset
      setInput('');
      setEntries([]);
      setPhase('input');
      router.refresh();
    } catch {
      setError('Network error while adding jobs');
      setPhase('review');
    }
  };

  const handleReset = useCallback(() => {
    abortRef.current = true;
    setInput('');
    setEntries([]);
    setPhase('input');
    setError(null);
  }, []);

  // --- Input phase ---
  if (phase === 'input') {
    return (
      <div className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            'Paste job URLs here, one per line...\n\nhttps://boards.greenhouse.io/company/jobs/123\nhttps://jobs.lever.co/company/abc-def\nhttps://company.com/careers/role'
          }
          rows={6}
          className="input w-full resize-y font-mono text-sm"
        />

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm muted">
            {urlCount === 0 ? (
              'No URLs detected'
            ) : overLimit ? (
              <span className="text-red-600">
                {urlCount} URLs detected (max {MAX_URLS})
              </span>
            ) : (
              `${urlCount} URL${urlCount === 1 ? '' : 's'} detected`
            )}
          </span>
          <button
            type="button"
            onClick={handleParse}
            disabled={urlCount === 0 || overLimit}
            className="btn btn-primary whitespace-nowrap"
          >
            Parse all
          </button>
        </div>
      </div>
    );
  }

  // --- Parsing / Review / Adding phase ---
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {phase === 'parsing' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="muted">
              Parsing... {parsedCount} of {entries.length}
            </span>
            <button type="button" onClick={handleCancel} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
          <div className="w-full h-2 rounded-full bg-amber-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${(parsedCount / entries.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Review header */}
      {phase === 'review' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {successEntries.length} parsed
            {failedEntries.length > 0 && (
              <span className="muted font-normal"> · {failedEntries.length} failed</span>
            )}
          </span>
          <button type="button" onClick={handleReset} className="btn btn-ghost btn-sm">
            Start over
          </button>
        </div>
      )}

      {/* Results list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {entries.map((entry, i) => (
          <div key={i} className={`bulk-progress-item ${entry.status}`}>
            {/* Status icon */}
            <span className="bulk-progress-icon">
              {entry.status === 'pending' && <span className="text-amber-400">○</span>}
              {entry.status === 'parsing' && <span className="bulk-spinner" />}
              {entry.status === 'success' && (
                <svg
                  className="w-4 h-4 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {entry.status === 'failed' && (
                <svg
                  className="w-4 h-4 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </span>

            {/* Content */}
            <span className="min-w-0 flex-1 truncate text-sm">
              {entry.status === 'success' && entry.job ? (
                <span>
                  <span className="font-medium">{entry.job.title || 'Unknown Position'}</span>
                  <span className="muted"> at </span>
                  <span>{entry.job.company || 'Unknown Company'}</span>
                </span>
              ) : (
                <span className={entry.status === 'failed' ? 'text-red-700' : 'muted'}>
                  {entry.url}
                  {entry.error && <span className="muted text-xs ml-2">— {entry.error}</span>}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && <div className="callout callout-error text-sm">{error}</div>}

      {/* Add button */}
      {(phase === 'review' || phase === 'adding') && successEntries.length > 0 && (
        <button
          type="button"
          onClick={handleAddAll}
          disabled={phase === 'adding'}
          className="btn btn-primary w-full"
        >
          {phase === 'adding'
            ? 'Adding...'
            : `Add ${successEntries.length} job${successEntries.length === 1 ? '' : 's'} to board`}
        </button>
      )}

      {/* All failed */}
      {phase === 'review' && successEntries.length === 0 && entries.length > 0 && (
        <div className="callout callout-warn text-sm">
          No jobs could be parsed. Try adding them manually instead.
        </div>
      )}
    </div>
  );
}
