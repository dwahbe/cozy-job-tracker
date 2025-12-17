'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ParsedJob, Column } from '@/lib/markdown';
import { ViewToggle } from './ViewToggle';
import { SortSelect, type SortOption } from './SortSelect';
import { JobCard } from './JobCard';
import { JobTable } from './JobTable';

const VIEW_STORAGE_KEY = 'cozy-jobs-view-preference';
const SORT_STORAGE_KEY = 'cozy-jobs-sort-preference';

const STATUS_ORDER = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

interface JobsViewProps {
  jobs: ParsedJob[];
  slug: string;
  columns: Column[];
}

export function JobsView({ jobs, slug, columns }: JobsViewProps) {
  const [view, setView] = useState<'cards' | 'table'>('table');
  const [sortBy, setSortBy] = useState<SortOption>('added-desc');

  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    if (savedView === 'cards' || savedView === 'table') {
      setView(savedView);
    }
    const savedSort = localStorage.getItem(SORT_STORAGE_KEY);
    if (savedSort) {
      setSortBy(savedSort as SortOption);
    }
  }, []);

  const handleViewChange = (newView: 'cards' | 'table') => {
    setView(newView);
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    localStorage.setItem(SORT_STORAGE_KEY, newSort);
  };

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      if (sortBy === 'added-desc') {
        // Newest first (reverse chronological by parsedOn)
        return b.parsedOn.localeCompare(a.parsedOn);
      }

      if (sortBy === 'due-asc') {
        // Jobs without due dates go to the end
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }

      if (sortBy === 'status-asc') {
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      }

      if (sortBy === 'status-desc') {
        return STATUS_ORDER.indexOf(b.status) - STATUS_ORDER.indexOf(a.status);
      }

      return 0;
    });
  }, [jobs, sortBy]);

  if (jobs.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-xl font-semibold mb-2">No jobs yet</p>
        <p className="muted">
          Paste a job posting URL above — we&apos;ll pull the details and you can save it in one
          click.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="muted text-sm">
          {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
        </p>
        <div className="flex items-center gap-2">
          <SortSelect sortBy={sortBy} onSortChange={handleSortChange} />
          <ViewToggle view={view} onViewChange={handleViewChange} />
        </div>
      </div>

      {view === 'cards' ? (
        <div className="space-y-4">
          {sortedJobs.map((job) => (
            <JobCard key={job.link} job={job} slug={slug} columns={columns} />
          ))}
        </div>
      ) : (
        <JobTable jobs={sortedJobs} slug={slug} columns={columns} />
      )}
    </div>
  );
}
