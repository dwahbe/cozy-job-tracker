'use client';

import { useState, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import type { ParsedJob, Column } from '@/lib/markdown';
import type { SortRule } from '@/lib/kv';
import type { JobView } from './ViewToggle';
import { ViewToggle } from './ViewToggle';
import { SortBuilder } from './SortSelect';
import { JobCard } from './JobCard';
import { JobTable } from './JobTable';
import { KanbanBoard } from './KanbanBoard';

const VIEW_STORAGE_KEY = 'cozy-jobs-view-preference';
const HIGHLIGHT_KEY = 'cozy-highlight-job';
const HIGHLIGHT_EVENT = 'cozy-highlight-change';

export function setHighlightJob(jobId: string) {
  sessionStorage.setItem(HIGHLIGHT_KEY, jobId);
  window.dispatchEvent(new Event(HIGHLIGHT_EVENT));
}

function clearHighlightJob() {
  sessionStorage.removeItem(HIGHLIGHT_KEY);
  window.dispatchEvent(new Event(HIGHLIGHT_EVENT));
}

function useHighlightJob(): [string | null, () => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener(HIGHLIGHT_EVENT, cb);
    return () => window.removeEventListener(HIGHLIGHT_EVENT, cb);
  }, []);
  const getSnapshot = useCallback(() => sessionStorage.getItem(HIGHLIGHT_KEY), []);
  const getServerSnapshot = useCallback(() => null, []);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [value, clearHighlightJob];
}

const STATUS_ORDER = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

// Same-tab notification for localStorage changes
const lsListeners = new Map<string, Set<() => void>>();

function notifyLS(key: string) {
  lsListeners.get(key)?.forEach((cb) => cb());
}

function useLocalStorage<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!lsListeners.has(key)) lsListeners.set(key, new Set());
      lsListeners.get(key)!.add(cb);
      const handler = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener('storage', handler);
      return () => {
        lsListeners.get(key)?.delete(cb);
        window.removeEventListener('storage', handler);
      };
    },
    [key]
  );
  const getSnapshot = useCallback(() => localStorage.getItem(key) as T | null, [key]);
  const getServerSnapshot = useCallback(() => null, []);
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setValue = useCallback(
    (v: T) => {
      localStorage.setItem(key, v);
      notifyLS(key);
    },
    [key]
  );
  return [stored ?? fallback, setValue];
}

// Get the value of a field from a job for sorting purposes
function getSortFieldValue(job: ParsedJob, field: string): string {
  if (field.startsWith('custom:')) return job.customFields[field.slice(7)] || '';
  switch (field) {
    case 'parsedOn':
      return job.parsedOn;
    case 'dueDate':
      return job.dueDate || '';
    case 'status':
      return job.status;
    case 'title':
      return job.title;
    case 'company':
      return job.company;
    case 'location':
      return job.location || '';
    case 'employmentType':
      return job.employmentType || '';
    case 'notes':
      return job.notes || '';
    default:
      return '';
  }
}

interface JobsViewProps {
  jobs: ParsedJob[];
  slug: string;
  columns: Column[];
  columnOrder: string[];
  initialSortPreference?: SortRule[];
}

export function JobsView({
  jobs,
  slug,
  columns,
  columnOrder,
  initialSortPreference,
}: JobsViewProps) {
  const [view, setStoredView] = useLocalStorage<JobView>(VIEW_STORAGE_KEY, 'kanban');
  const [sorts, setSorts] = useState<SortRule[]>(initialSortPreference ?? []);
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState(0);
  const [highlightJobId, clearHighlight] = useHighlightJob();

  const handleViewChange = (newView: JobView) => {
    setStoredView(newView);
  };

  const handleSortsChange = useCallback(
    (newSorts: SortRule[]) => {
      setSorts(newSorts);
      // Persist to server
      fetch('/api/update-sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, sortPreference: newSorts }),
      }).catch(console.error);
    },
    [slug]
  );

  const sortedJobs = useMemo(() => {
    // No active sorts — default to newest first
    if (sorts.length === 0) {
      return [...jobs].sort((a, b) => b.parsedOn.localeCompare(a.parsedOn));
    }

    // Build a lookup of custom dropdown option orders for sorting
    const dropdownOrders = new Map<string, string[]>();
    for (const col of columns) {
      if (col.type === 'dropdown' && col.options) {
        dropdownOrders.set(`custom:${col.name}`, col.options);
      }
    }

    return [...jobs].sort((a, b) => {
      for (const rule of sorts) {
        const aVal = getSortFieldValue(a, rule.field);
        const bVal = getSortFieldValue(b, rule.field);

        // Empty values always sort to the bottom
        if (!aVal && !bVal) continue;
        if (!aVal) return 1;
        if (!bVal) return -1;

        let cmp: number;

        if (rule.field === 'status') {
          cmp = STATUS_ORDER.indexOf(aVal) - STATUS_ORDER.indexOf(bVal);
        } else if (rule.field === 'dueDate') {
          const aRolling = aVal === 'rolling';
          const bRolling = bVal === 'rolling';
          if (aRolling && bRolling) cmp = 0;
          else if (aRolling) cmp = -1;
          else if (bRolling) cmp = 1;
          else cmp = aVal.localeCompare(bVal);
        } else if (dropdownOrders.has(rule.field)) {
          // Sort custom dropdowns by their defined option order
          const opts = dropdownOrders.get(rule.field)!;
          cmp = opts.indexOf(aVal) - opts.indexOf(bVal);
        } else {
          cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
        }

        if (rule.direction === 'desc') cmp = -cmp;
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [jobs, sorts, columns]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedJobs;
    return sortedJobs.filter((job) => {
      const haystack = [
        job.title,
        job.company,
        job.location,
        job.employmentType,
        job.notes,
        job.status,
        ...Object.values(job.customFields),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedJobs, search]);

  if (jobs.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-xl font-semibold mb-2">No jobs yet</p>
        <p className="muted">
          Paste a job posting URL above — the details get filled in and you can save it in one
          click.
        </p>
      </div>
    );
  }

  const isFiltered = search.trim().length > 0;

  return (
    <div>
      <div className="jobs-toolbar">
        <div className="jobs-toolbar-search-row">
          <div className="search-wrapper jobs-toolbar-search">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="search-icon"
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M11 11l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                // Capture current height before filtering to prevent page jump
                if (!search && e.target.value && listRef.current) {
                  setMinHeight(listRef.current.offsetHeight);
                }
                if (!e.target.value) {
                  setMinHeight(0);
                }
                setSearch(e.target.value);
              }}
              placeholder="Search jobs..."
              className="search-input"
            />
            {search && (
              <button
                onClick={() => {
                  setMinHeight(0);
                  setSearch('');
                }}
                className="search-clear"
                aria-label="Clear search"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M3 3l6 6M9 3l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
          <p className="muted text-sm whitespace-nowrap">
            {isFiltered ? `${filteredJobs.length} of ${jobs.length}` : jobs.length}{' '}
            {jobs.length === 1 ? 'job' : 'jobs'}
          </p>
        </div>
        <div className="jobs-toolbar-controls">
          <SortBuilder sorts={sorts} onSortsChange={handleSortsChange} columns={columns} />
          <ViewToggle view={view} onViewChange={handleViewChange} />
        </div>
      </div>

      <div ref={listRef} style={{ minHeight: isFiltered ? minHeight : undefined }}>
        {filteredJobs.length === 0 && isFiltered ? (
          <div className="card p-10 text-center">
            <p className="text-lg font-semibold mb-1">No matches</p>
            <p className="muted text-sm">
              Nothing matched &ldquo;{search.trim()}&rdquo; —{' '}
              <button
                onClick={() => setSearch('')}
                className="underline underline-offset-2 hover:text-foreground"
              >
                clear search
              </button>
            </p>
          </div>
        ) : view === 'kanban' ? (
          <KanbanBoard
            jobs={filteredJobs}
            slug={slug}
            columns={columns}
            highlightJobId={highlightJobId}
            onHighlightDone={clearHighlight}
          />
        ) : view === 'cards' ? (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.link}
                job={job}
                slug={slug}
                columns={columns}
                highlight={job.id === highlightJobId}
                onHighlightDone={clearHighlight}
              />
            ))}
          </div>
        ) : (
          <JobTable
            jobs={filteredJobs}
            slug={slug}
            columns={columns}
            columnOrder={columnOrder}
            highlightJobId={highlightJobId}
            onHighlightDone={clearHighlight}
          />
        )}
      </div>
    </div>
  );
}
