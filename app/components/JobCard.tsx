'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';
import { celebrateOffer } from '@/lib/confetti';

interface JobCardProps {
  job: ParsedJob;
  slug: string;
  columns: Column[];
}

interface EditableFields {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  notes: string;
  link: string;
}

const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

function DueDatePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(false);
  };

  const handleRollingClick = () => {
    onChange('rolling');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const displayText = value ? formatDateDisplay(value) : 'Set due date';

  return (
    <div className="flex items-center gap-2 text-sm" ref={containerRef}>
      <span className="muted">📅</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="hover:underline underline-offset-2 text-left"
        >
          {displayText}
        </button>
        {isOpen && (
          <div className="absolute z-50 top-full left-0 mt-1 bg-surface-solid border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
            <div className="space-y-2">
              <input
                type="date"
                value={value === 'rolling' ? '' : value}
                onChange={handleDateChange}
                className="input w-full text-sm"
              />
              <button
                type="button"
                onClick={handleRollingClick}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  value === 'rolling' ? 'bg-accent-soft text-accent' : 'hover:bg-black/5'
                }`}
              >
                🔄 Rolling basis
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full text-left px-3 py-2 rounded-md text-sm muted hover:bg-black/5 transition-colors"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr === 'rolling') return 'Rolling';
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  const ordinal = (n: number) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };
  return `${month} ${day}${ordinal(day)} ${year}`;
};

function getFieldValue(job: ParsedJob, field: string): string {
  switch (field.toLowerCase()) {
    case 'status': return job.status;
    case 'title': return job.title;
    case 'company': return job.company;
    case 'location': return job.location || '';
    case 'employment type': return job.employmentType || '';
    case 'notes': return job.notes || '';
    case 'due date': return job.dueDate || '';
    default: return job.customFields[field] || '';
  }
}

function applyFieldUpdate(job: ParsedJob, field: string, value: string): void {
  switch (field.toLowerCase()) {
    case 'status': job.status = value; break;
    case 'title': job.title = value; break;
    case 'company': job.company = value; break;
    case 'location': job.location = value; break;
    case 'employment type': job.employmentType = value; break;
    case 'notes': job.notes = value; break;
    case 'due date': job.dueDate = value; break;
    default: job.customFields[field] = value;
  }
}

const statusColor = (status: string) =>
  ({
    Saved: 'status-saved',
    Applied: 'status-applied',
    Interview: 'status-interview',
    Offer: 'status-offer',
    Rejected: 'status-rejected',
  })[status] || 'status-saved';

export function JobCard({ job: serverJob, slug, columns }: JobCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState<EditableFields>({
    title: serverJob.title,
    company: serverJob.company,
    location: serverJob.location || '',
    employmentType: serverJob.employmentType || '',
    notes: serverJob.notes || '',
    link: serverJob.link,
  });

  // Reconcile optimistic state when server data arrives
  useEffect(() => {
    setPendingUpdates((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next: Record<string, string> = {};
      for (const [field, value] of Object.entries(prev)) {
        if (getFieldValue(serverJob, field) !== value) {
          next[field] = value;
        }
      }
      return Object.keys(next).length > 0 ? next : {};
    });
  }, [serverJob]);

  // Apply optimistic updates for instant UI feedback
  const effectiveJob = useMemo(() => {
    if (Object.keys(pendingUpdates).length === 0) return serverJob;
    const ej: typeof serverJob = { ...serverJob, customFields: { ...serverJob.customFields } };
    for (const [field, val] of Object.entries(pendingUpdates)) {
      applyFieldUpdate(ej, field, val);
    }
    return ej;
  }, [serverJob, pendingUpdates]);

  // Shadow prop so existing render code uses optimistic values
  const job = effectiveJob;

  const updateField = async (field: string, value: string) => {
    // Optimistic update - UI reflects change immediately
    setPendingUpdates((prev) => ({ ...prev, [field]: value }));

    try {
      const response = await fetch('/api/update-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobLink: serverJob.link, field, value }),
      });

      if (response.ok) {
        if (field === 'Status' && value === 'Offer') {
          celebrateOffer();
        }
        router.refresh();
      } else {
        setPendingUpdates((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    } catch (err) {
      console.error('Update failed:', err);
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Move this job to trash?')) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/delete-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobLink: serverJob.link }),
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

  const handleEdit = () => {
    setEditFields({
      title: job.title,
      company: job.company,
      location: job.location || '',
      employmentType: job.employmentType || '',
      notes: job.notes || '',
      link: serverJob.link,
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updates: { field: string; value: string }[] = [];

      if (editFields.title !== job.title) {
        updates.push({ field: 'Title', value: editFields.title });
      }
      if (editFields.company !== job.company) {
        updates.push({ field: 'Company', value: editFields.company });
      }
      if (editFields.location !== (job.location || '')) {
        updates.push({ field: 'Location', value: editFields.location });
      }
      if (editFields.employmentType !== (job.employmentType || '')) {
        updates.push({ field: 'Employment type', value: editFields.employmentType });
      }
      if (editFields.notes !== (job.notes || '')) {
        updates.push({ field: 'Notes', value: editFields.notes });
      }
      if (editFields.link !== serverJob.link) {
        updates.push({ field: 'Link', value: editFields.link });
      }

      if (updates.length > 0) {
        // Optimistic update
        for (const update of updates) {
          setPendingUpdates((prev) => ({ ...prev, [update.field]: update.value }));
        }

        // Single batch API call instead of N sequential calls
        await fetch('/api/update-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, jobLink: serverJob.link, fields: updates }),
        });
      }

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg tracking-tight">Edit job</h3>
          <button onClick={handleCancelEdit} className="text-sm muted hover:text-black">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Title</label>
              <input
                type="text"
                value={editFields.title}
                onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Company</label>
              <input
                type="text"
                value={editFields.company}
                onChange={(e) => setEditFields({ ...editFields, company: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input
                type="text"
                value={editFields.location}
                onChange={(e) => setEditFields({ ...editFields, location: e.target.value })}
                placeholder="e.g. Remote, San Francisco"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Employment type</label>
              <input
                type="text"
                value={editFields.employmentType}
                onChange={(e) => setEditFields({ ...editFields, employmentType: e.target.value })}
                placeholder="e.g. Full-time, Contract"
                className="input w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Link</label>
              <input
                type="url"
                value={editFields.link}
                onChange={(e) => setEditFields({ ...editFields, link: e.target.value })}
                placeholder="https://..."
                className="input w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Salary / notes</label>
              <textarea
                value={editFields.notes}
                onChange={(e) => setEditFields({ ...editFields, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={2}
                className="input w-full resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editFields.title || !editFields.company}
              className="btn btn-primary flex-1"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button onClick={handleCancelEdit} disabled={saving} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-hover p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-lg tracking-tight">{job.title}</h3>
          <p className="muted">{job.company}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleEdit}
            className="p-1.5 rounded-md hover:bg-black/5 text-sm muted hover:text-black transition-colors"
            title="Edit job"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-md hover:bg-danger-soft text-sm muted hover:text-danger transition-colors"
            title="Delete job"
          >
            🗑️
          </button>
        </div>
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
      <div className="flex flex-col gap-3 pt-4 border-t border-black/5">
        {/* Due date */}
        <DueDatePicker
          value={job.dueDate || ''}
          onChange={(value) => updateField('Due date', value)}
        />

        {/* Status dropdown */}
        <div className="flex items-center gap-2 text-sm">
          <span className="muted">📊</span>
          <select
            value={job.status}
            onChange={(e) => updateField('Status', e.target.value)}
            className={`status-select ${statusColor(job.status)}`}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
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
                  className="h-4 w-4 accent-accent"
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
                  onChange={(e) =>
                    setTextFields((prev) => ({ ...prev, [col.name]: e.target.value }))
                  }
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    const oldValue = job.customFields[col.name] || '';
                    if (newValue !== oldValue) {
                      updateField(col.name, newValue);
                    }
                    setTextFields((prev) => {
                      const next = { ...prev };
                      delete next[col.name];
                      return next;
                    });
                  }}
                  placeholder="..."
                  className="input w-28 py-1.5 text-sm"
                />
              </>
            )}
          </div>
        ))}
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
