'use client';

import { useState, useEffect } from 'react';
import type { ParsedJob, Column } from '@/lib/markdown';
import { ViewToggle } from './ViewToggle';
import { JobCard } from './JobCard';
import { JobTable } from './JobTable';

const VIEW_STORAGE_KEY = 'cozy-jobs-view-preference';

interface JobsViewProps {
  jobs: ParsedJob[];
  slug: string;
  columns: Column[];
}

export function JobsView({ jobs, slug, columns }: JobsViewProps) {
  const [view, setView] = useState<'cards' | 'table'>('table');

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === 'cards' || saved === 'table') {
      setView(saved);
    }
  }, []);

  const handleViewChange = (newView: 'cards' | 'table') => {
    setView(newView);
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
  };

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
        <ViewToggle view={view} onViewChange={handleViewChange} />
      </div>

      {view === 'cards' ? (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard key={job.link} job={job} slug={slug} columns={columns} />
          ))}
        </div>
      ) : (
        <JobTable jobs={jobs} slug={slug} columns={columns} />
      )}
    </div>
  );
}
