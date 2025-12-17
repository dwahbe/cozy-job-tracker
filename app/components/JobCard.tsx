'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';

interface JobCardProps {
  job: ParsedJob;
  slug: string;
  columns: Column[];
}

const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

export function JobCard({ job, slug, columns }: JobCardProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [textFields, setTextFields] = useState<Record<string, string>>({});

  const updateField = async (field: string, value: string) => {
    setUpdating(field);
    try {
      const response = await fetch('/api/update-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobLink: job.link, field, value }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/delete-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobLink: job.link }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const statusColor = {
    Saved: 'bg-amber-100 text-amber-950',
    Applied: 'bg-sky-100 text-sky-950',
    Interview: 'bg-violet-100 text-violet-950',
    Offer: 'bg-emerald-100 text-emerald-950',
    Rejected: 'bg-rose-100 text-rose-950',
  }[job.status] || 'bg-amber-100 text-amber-950';

  return (
    <div className="card card-hover p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-lg tracking-tight">{job.title}</h3>
          <p className="muted">{job.company}</p>
        </div>
        <span className={`px-2.5 py-1 text-xs rounded-full font-semibold ${statusColor}`}>
          {job.status}
        </span>
      </div>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex items-center gap-2">
          <span className="muted">📍</span>
          <span>{job.location || 'Not listed'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="muted">💼</span>
          <span>{job.employmentType || 'Not listed'}</span>
        </div>
        {job.notes && (
          <div className="flex items-center gap-2">
            <span className="muted">📝</span>
            <span>{job.notes}</span>
          </div>
        )}
        {job.dueDate && (
          <div className="flex items-center gap-2">
            <span className="muted">📅</span>
            <span>Due: {job.dueDate}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="muted">🔗</span>
          <a
            href={job.link}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate max-w-xs font-medium hover:underline decoration-2 underline-offset-4"
          >
            View posting
          </a>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-black/5">
        {/* Status dropdown */}
        <select
          value={job.status}
          onChange={(e) => updateField('Status', e.target.value)}
          disabled={updating === 'Status'}
          className="select w-auto py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {/* Due date */}
        <div className="flex items-center gap-2">
          <span className="text-sm muted">Due:</span>
          <input
            type="date"
            value={job.dueDate || ''}
            onChange={(e) => updateField('Due date', e.target.value)}
            disabled={updating === 'Due date'}
            className="input w-auto py-1.5 text-sm"
          />
        </div>

        {/* Custom columns */}
        {columns.map((col) => (
          <div key={col.name} className="flex items-center gap-2">
            {col.type === 'checkbox' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={job.customFields[col.name] === 'Yes'}
                  onChange={(e) => updateField(col.name, e.target.checked ? 'Yes' : 'No')}
                  disabled={updating === col.name}
                  className="h-4 w-4 accent-orange-500"
                />
                <span className="text-sm">{col.name}</span>
              </label>
            )}
            {col.type === 'dropdown' && col.options && (
              <>
                <span className="text-sm muted">{col.name}:</span>
                <select
                  value={job.customFields[col.name] || ''}
                  onChange={(e) => updateField(col.name, e.target.value)}
                  disabled={updating === col.name}
                  className="select w-auto py-1.5 text-sm"
                >
                  <option value="">—</option>
                  {col.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </>
            )}
            {col.type === 'text' && (
              <>
                <span className="text-sm muted">{col.name}:</span>
                <input
                  type="text"
                  value={textFields[col.name] ?? job.customFields[col.name] ?? ''}
                  onChange={(e) => setTextFields(prev => ({ ...prev, [col.name]: e.target.value }))}
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    const oldValue = job.customFields[col.name] || '';
                    if (newValue !== oldValue) {
                      updateField(col.name, newValue);
                    }
                    setTextFields(prev => {
                      const next = { ...prev };
                      delete next[col.name];
                      return next;
                    });
                  }}
                  disabled={updating === col.name}
                  placeholder="..."
                  className="input w-28 py-1.5 text-sm"
                />
              </>
            )}
          </div>
        ))}

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto btn btn-ghost text-sm text-rose-700"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Meta info */}
      <div className="mt-4 pt-4 border-t border-black/5 flex items-center gap-4 text-xs muted">
        <span>Added: {job.parsedOn}</span>
        <span className={job.verified === 'Yes' ? 'text-emerald-700' : 'text-amber-700'}>
          {job.verified === 'Yes' ? '✓ Verified' : '⚠ Partial'}
        </span>
      </div>
    </div>
  );
}

