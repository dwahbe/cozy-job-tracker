'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ValidatedJob } from '@/lib/validateExtraction';
import type { Column } from '@/lib/markdown';

interface JobFormProps {
  slug: string;
  columns: Column[];
}

interface ManualJob {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  link: string;
  notes: string;
  customFields: Record<string, string>;
}

const emptyManualJob: ManualJob = {
  title: '',
  company: '',
  location: '',
  employmentType: '',
  link: '',
  notes: '',
  customFields: {},
};

export function JobForm({ slug, columns }: JobFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'url' | 'manual'>('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [parsedJob, setParsedJob] = useState<ValidatedJob | null>(null);
  const [fetchWarning, setFetchWarning] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [manualJob, setManualJob] = useState<ManualJob>(emptyManualJob);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorType(null);
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
        setErrorType(data.errorType || null);
        return;
      }

      setParsedJob(data.job);
      if (data.fetchWarning) {
        setFetchWarning(data.fetchWarning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse job');
      setErrorType('network_error');
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

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualJob.title || !manualJob.company) return;

    setAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/add-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, manualJob }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add job');
        return;
      }

      // Reset form and refresh page
      setManualJob(emptyManualJob);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setAdding(false);
    }
  };

  const switchMode = (newMode: 'url' | 'manual') => {
    setMode(newMode);
    setError(null);
    setErrorType(null);
    setParsedJob(null);
    setFetchWarning(null);
  };

  return (
    <div className="mb-8 card p-7">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Add a job</h2>
          <p className="muted text-sm">
            {mode === 'url'
              ? "Paste a posting URL. We'll extract and preview the details."
              : 'Enter job details manually.'}
          </p>
        </div>
        <div className="view-toggle shrink-0 self-start">
          <button
            type="button"
            onClick={() => switchMode('url')}
            className={`view-toggle-btn ${mode === 'url' ? 'active' : ''}`}
          >
            From URL
          </button>
          <button
            type="button"
            onClick={() => switchMode('manual')}
            className={`view-toggle-btn ${mode === 'manual' ? 'active' : ''}`}
          >
            Manual
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <>
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

          {fetchWarning && <div className="callout callout-warn mb-4">Warning: {fetchWarning}</div>}

          {parsedJob && (
            <div className="card card-solid p-5">
              <h3 className="text-base font-semibold mb-3">Preview</h3>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span className="muted sm:w-32 shrink-0">Title:</span>
                  <span className={parsedJob.title ? '' : 'muted italic'}>
                    {parsedJob.title || 'Not found'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span className="muted sm:w-32 shrink-0">Company:</span>
                  <span className={parsedJob.company ? '' : 'muted italic'}>
                    {parsedJob.company || 'Not found'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span className="muted sm:w-32 shrink-0">Location:</span>
                  <span className={parsedJob.location ? '' : 'muted italic'}>
                    {parsedJob.location || 'Not found'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span className="muted sm:w-32 shrink-0">Type:</span>
                  <span className={parsedJob.employment_type ? '' : 'muted italic'}>
                    {parsedJob.employment_type || 'Not found'}
                  </span>
                </div>
                {parsedJob.due_date && (
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <span className="muted sm:w-32 shrink-0">Due Date:</span>
                    <span>
                      {parsedJob.due_date === 'rolling' ? '🔄 Rolling basis' : parsedJob.due_date}
                    </span>
                  </div>
                )}
                {parsedJob.notes && (
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <span className="muted sm:w-32 shrink-0">Salary / Notes:</span>
                    <span>{parsedJob.notes}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span className="muted sm:w-32 shrink-0">Link:</span>
                  <a
                    href={parsedJob.finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline decoration-2 underline-offset-4"
                  >
                    {parsedJob.finalUrl}
                  </a>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span className="muted sm:w-32 shrink-0">Verified:</span>
                  <span className={parsedJob.isVerified ? 'text-emerald-700' : 'text-amber-700'}>
                    {parsedJob.isVerified ? 'Yes' : 'Partial'}
                  </span>
                </div>
              </div>

              <button onClick={handleAdd} disabled={adding} className="btn btn-primary w-full">
                {adding ? 'Adding...' : 'Add to board'}
              </button>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleManualAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualJob.title}
                onChange={(e) => setManualJob({ ...manualJob, title: e.target.value })}
                placeholder="e.g. Software Engineer"
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualJob.company}
                onChange={(e) => setManualJob({ ...manualJob, company: e.target.value })}
                placeholder="e.g. Acme Inc"
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input
                type="text"
                value={manualJob.location}
                onChange={(e) => setManualJob({ ...manualJob, location: e.target.value })}
                placeholder="e.g. Remote, San Francisco"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Employment Type</label>
              <input
                type="text"
                value={manualJob.employmentType}
                onChange={(e) => setManualJob({ ...manualJob, employmentType: e.target.value })}
                placeholder="e.g. Full-time, Contract"
                className="input w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Link (optional)</label>
              <input
                type="url"
                value={manualJob.link}
                onChange={(e) => setManualJob({ ...manualJob, link: e.target.value })}
                placeholder="https://..."
                className="input w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Salary / Notes</label>
              <textarea
                value={manualJob.notes}
                onChange={(e) => setManualJob({ ...manualJob, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={2}
                className="input w-full resize-none"
              />
            </div>

            {/* Custom columns */}
            {columns.map((col) => (
              <div key={col.name}>
                <label className="block text-sm font-medium mb-1.5">{col.name}</label>
                {col.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualJob.customFields[col.name] === 'Yes'}
                      onChange={(e) =>
                        setManualJob({
                          ...manualJob,
                          customFields: {
                            ...manualJob.customFields,
                            [col.name]: e.target.checked ? 'Yes' : 'No',
                          },
                        })
                      }
                      className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm muted">Yes</span>
                  </label>
                ) : col.type === 'dropdown' && col.options ? (
                  <select
                    value={manualJob.customFields[col.name] || ''}
                    onChange={(e) =>
                      setManualJob({
                        ...manualJob,
                        customFields: {
                          ...manualJob.customFields,
                          [col.name]: e.target.value,
                        },
                      })
                    }
                    className="select w-full"
                  >
                    <option value="">—</option>
                    {col.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={manualJob.customFields[col.name] || ''}
                    onChange={(e) =>
                      setManualJob({
                        ...manualJob,
                        customFields: {
                          ...manualJob.customFields,
                          [col.name]: e.target.value,
                        },
                      })
                    }
                    className="input w-full"
                  />
                )}
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={adding || !manualJob.title || !manualJob.company}
            className="btn btn-primary w-full"
          >
            {adding ? 'Adding...' : 'Add to board'}
          </button>
        </form>
      )}

      {error && (
        <div className="callout callout-error mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{error}</span>
            {errorType && ['bot_protection', 'http_error', 'empty_content'].includes(errorType) && (
              <button
                type="button"
                onClick={() => switchMode('manual')}
                className="btn btn-sm whitespace-nowrap"
              >
                Use Manual Entry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
