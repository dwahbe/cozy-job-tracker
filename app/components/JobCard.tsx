'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';
import { dropdownColorClass } from '@/lib/dropdown-colors';
import { celebrateOffer } from '@/lib/confetti';
import {
  statusColor,
  getFieldValue,
  applyFieldUpdate,
  formatDateDisplay,
  toHref,
  STATUS_OPTIONS,
} from '@/lib/job-utils';
import { DueDatePicker } from './DueDatePicker';
import { showToast } from './Toast';

interface JobCardProps {
  job: ParsedJob;
  columns: Column[];
  highlight?: boolean;
  onHighlightDone?: () => void;
}

interface EditableFields {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  notes: string;
  link: string;
}

export function JobCard({ job: serverJob, columns, highlight, onHighlightDone }: JobCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditableFields>({
    title: serverJob.title,
    company: serverJob.company,
    location: serverJob.location || '',
    employmentType: serverJob.employmentType || '',
    notes: serverJob.notes || '',
    link: serverJob.link,
  });

  // Scroll into view once when this card becomes the highlighted one, not on every render.
  useEffect(() => {
    if (highlight) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

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
        body: JSON.stringify({ jobId: serverJob.id, field, value }),
      });

      if (response.ok) {
        if (field === 'Status' && value === 'Offer') {
          celebrateOffer();
        }
        router.refresh();
      } else {
        const data = (await response.json().catch(() => ({}))) as { error?: unknown };
        showToast(typeof data.error === 'string' ? data.error : "Couldn't save that change.");
        setPendingUpdates((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    } catch (err) {
      console.error('Update failed:', err);
      showToast("Couldn't save that change — check your connection.");
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
        body: JSON.stringify({ jobId: serverJob.id }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = (await response.json().catch(() => ({}))) as { error?: unknown };
        showToast(typeof data.error === 'string' ? data.error : "Couldn't move the job to trash.");
      }
    } catch (err) {
      console.error('Delete failed:', err);
      showToast("Couldn't move the job to trash — check your connection.");
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
    setSaveError(null);
  };

  const handleSaveEdit = async () => {
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
    if (editFields.link !== job.link) {
      updates.push({ field: 'Link', value: editFields.link });
    }

    if (updates.length === 0) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    // Optimistic: show the new values right away; rolled back below if the server says no.
    setPendingUpdates((prev) => ({
      ...prev,
      ...Object.fromEntries(updates.map((u) => [u.field, u.value])),
    }));
    const rollback = () =>
      setPendingUpdates((prev) => {
        const next = { ...prev };
        for (const u of updates) delete next[u.field];
        return next;
      });

    try {
      // Single batch API call instead of N sequential calls
      const response = await fetch('/api/update-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: serverJob.id, fields: updates }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: unknown };
        setSaveError(
          typeof data.error === 'string' ? data.error : "Couldn't save — please try again."
        );
        rollback();
        return; // stay in edit mode so nothing typed is lost
      }
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError("Couldn't save — check your connection and try again.");
      rollback();
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg tracking-tight">Edit job</h3>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="text-sm muted hover:text-black"
            aria-label="Cancel editing"
          >
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

          {saveError && (
            <p className="text-sm text-danger" role="alert">
              {saveError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={saving || !editFields.title || !editFields.company}
              className="btn btn-primary flex-1"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`card card-hover p-6${highlight ? ' card-highlight' : ''}`}
      onAnimationEnd={highlight ? onHighlightDone : undefined}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-lg tracking-tight">{job.title}</h3>
          <p className="muted">{job.company}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleEdit}
            className="p-1.5 rounded-md hover:bg-black/5 text-sm muted hover:text-black transition-colors"
            title="Edit job"
            aria-label="Edit job"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-md hover:bg-danger-soft text-sm muted hover:text-danger transition-colors"
            title="Delete job"
            aria-label="Move to trash"
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
          {job.link ? (
            <a
              href={toHref(job.link)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate max-w-xs font-medium hover:underline decoration-2 underline-offset-4"
            >
              View posting
            </a>
          ) : (
            <span className="muted">No link</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 pt-4 border-t border-black/5">
        {/* Due date */}
        <div className="flex items-center gap-2 text-sm">
          <span className="muted">📅</span>
          <DueDatePicker
            value={job.dueDate || ''}
            onChange={(value) => updateField('Due date', value)}
            placeholder="Set due date"
          />
        </div>

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
                  className={`select w-auto py-1.5 text-sm ${dropdownColorClass(col.optionColors?.[job.customFields[col.name]])}`}
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
            {col.type === 'date' && (
              <>
                <span className="text-sm muted">{col.name}:</span>
                <DueDatePicker
                  value={job.customFields[col.name] || ''}
                  onChange={(value) => updateField(col.name, value)}
                  placeholder="Set date"
                />
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
        <span>Added: {formatDateDisplay(job.parsedOn) || job.parsedOn}</span>
        <span className={job.verified === 'Yes' ? 'text-emerald-700' : 'text-amber-700'}>
          {job.verified === 'Yes' ? '✓ Verified' : '⚠ Partial'}
        </span>
      </div>
    </div>
  );
}
