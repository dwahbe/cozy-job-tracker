'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ValidatedJob } from '@/lib/validateExtraction';
import type { Column } from '@/lib/markdown';

interface JobFormProps {
  slug: string;
  columns: Column[];
}

export function JobForm({ slug, columns }: JobFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedJob, setParsedJob] = useState<ValidatedJob | null>(null);
  const [fetchWarning, setFetchWarning] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setParsedJob(null);
    setFetchWarning(null);

    try {
      const response = await fetch('/api/parse-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to parse job');
        return;
      }

      setParsedJob(data.job);
      if (data.fetchWarning) {
        setFetchWarning(data.fetchWarning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse job');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!parsedJob) return;

    setAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/add-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, job: parsedJob }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add job');
        return;
      }

      // Reset form and refresh page
      setUrl('');
      setParsedJob(null);
      setFetchWarning(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mb-8 card p-7">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Add a job</h2>
          <p className="muted text-sm">Paste a posting URL. We&apos;ll extract and preview the details.</p>
        </div>
      </div>
      
      <form onSubmit={handleParse} className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste job posting URL..."
          required
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={loading || !url}
          className="btn btn-primary whitespace-nowrap"
        >
          {loading ? 'Parsing...' : 'Parse job'}
        </button>
      </form>

      {error && (
        <div className="callout callout-error mb-4">{error}</div>
      )}

      {fetchWarning && (
        <div className="callout callout-warn mb-4">Warning: {fetchWarning}</div>
      )}

      {parsedJob && (
        <div className="card card-solid p-5">
          <h3 className="text-base font-semibold mb-3">Preview</h3>
          
          <div className="space-y-2 text-sm mb-4">
            <div className="flex gap-2">
              <span className="muted w-32">Title:</span>
              <span className={parsedJob.title ? '' : 'muted italic'}>
                {parsedJob.title || 'Not found'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="muted w-32">Company:</span>
              <span className={parsedJob.company ? '' : 'muted italic'}>
                {parsedJob.company || 'Not found'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="muted w-32">Location:</span>
              <span className={parsedJob.location ? '' : 'muted italic'}>
                {parsedJob.location || 'Not found'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="muted w-32">Type:</span>
              <span className={parsedJob.employment_type ? '' : 'muted italic'}>
                {parsedJob.employment_type || 'Not found'}
              </span>
            </div>
            {parsedJob.notes && (
              <div className="flex gap-2">
                <span className="muted w-32">Notes:</span>
                <span>{parsedJob.notes}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="muted w-32">Verified:</span>
              <span className={parsedJob.isVerified ? 'text-emerald-700' : 'text-amber-700'}>
                {parsedJob.isVerified ? 'Yes' : 'Partial'}
              </span>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={adding}
            className="btn btn-primary w-full"
          >
            {adding ? 'Adding...' : 'Add to board'}
          </button>
        </div>
      )}
    </div>
  );
}

