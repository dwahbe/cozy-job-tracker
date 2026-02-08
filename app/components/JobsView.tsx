'use client';

import { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import type { ParsedJob, Column } from '@/lib/markdown';
import { ViewToggle } from './ViewToggle';
import { SortBuilder, type SortRule } from './SortSelect';
import { JobCard } from './JobCard';
import { JobTable } from './JobTable';

const VIEW_STORAGE_KEY = 'cozy-jobs-view-preference';
const SORT_STORAGE_KEY = 'cozy-jobs-sort-preference';

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
      const handler = (e: StorageEvent) => { if (e.key === key) cb(); };
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
    case 'parsedOn': return job.parsedOn;
    case 'dueDate': return job.dueDate || '';
    case 'status': return job.status;
    case 'title': return job.title;
    case 'company': return job.company;
    case 'location': return job.location || '';
    case 'employmentType': return job.employmentType || '';
    case 'notes': return job.notes || '';
    default: return '';
  }
}

interface JobsViewProps {
  jobs: ParsedJob[];
  slug: string;
  columns: Column[];
  columnOrder: string[];
}

export function JobsView({ jobs, slug, columns, columnOrder }: JobsViewProps) {
  const [view, setStoredView] = useLocalStorage<'cards' | 'table'>(VIEW_STORAGE_KEY, 'table');
  const [sortsRaw, setSortsRaw] = useLocalStorage<string>(SORT_STORAGE_KEY, '[]');
  const [search, setSearch] = useState('');

  const handleViewChange = (newView: 'cards' | 'table') => {
    setStoredView(newView);
  };

  // Parse sort rules from localStorage, with legacy format migration
  const sorts: SortRule[] = useMemo(() => {
    try {
      const parsed = JSON.parse(sortsRaw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Migrate legacy single-sort format
      const legacy: Record<string, SortRule[]> = {
        'added-desc': [{ field: 'parsedOn', direction: 'desc' }],
        'due-asc': [{ field: 'dueDate', direction: 'asc' }],
        'status-asc': [{ field: 'status', direction: 'asc' }],
        'status-desc': [{ field: 'status', direction: 'desc' }],
      };
      if (legacy[sortsRaw]) return legacy[sortsRaw];
    }
    return [];
  }, [sortsRaw]);

  const handleSortsChange = useCallback(
    (newSorts: SortRule[]) => {
      setSortsRaw(JSON.stringify(newSorts));
    },
    [setSortsRaw]
  );

  const sortedJobs = useMemo(() => {
    // No active sorts — default to newest first
    if (sorts.length === 0) {
      return [...jobs].sort((a, b) => b.parsedOn.localeCompare(a.parsedOn));
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
        } else {
          cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
        }

        if (rule.direction === 'desc') cmp = -cmp;
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [jobs, sorts]);

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
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="search-wrapper" style={{ width: '280px', minWidth: '140px', flexShrink: 1 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="search-icon"
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="search-input"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="search-clear"
                aria-label="Clear search"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <p className="muted text-sm whitespace-nowrap" style={{ minWidth: '4.5rem' }}>
            {isFiltered
              ? `${filteredJobs.length} of ${jobs.length}`
              : jobs.length}{' '}
            {jobs.length === 1 ? 'job' : 'jobs'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SortBuilder sorts={sorts} onSortsChange={handleSortsChange} columns={columns} />
          <ViewToggle view={view} onViewChange={handleViewChange} />
        </div>
      </div>

      {filteredJobs.length === 0 && isFiltered ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold mb-1">No matches</p>
          <p className="muted text-sm">
            Nothing matched &ldquo;{search.trim()}&rdquo; —{' '}
            <button onClick={() => setSearch('')} className="underline underline-offset-2 hover:text-foreground">
              clear search
            </button>
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <JobCard key={job.link} job={job} slug={slug} columns={columns} />
          ))}
        </div>
      ) : (
        <JobTable jobs={filteredJobs} slug={slug} columns={columns} columnOrder={columnOrder} />
      )}
    </div>
  );
}
