'use client';

import { useState } from 'react';
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

const statusColor = (status: string) =>
  ({
    Saved: 'status-saved',
    Applied: 'status-applied',
    Interview: 'status-interview',
    Offer: 'status-offer',
    Rejected: 'status-rejected',
  })[status] || 'status-saved';

export function JobCard({ job, slug, columns }: JobCardProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState<EditableFields>({
    title: job.title,
    company: job.company,
    location: job.location || '',
    employmentType: job.employmentType || '',
    notes: job.notes || '',
    link: job.link,
  });

  const updateField = async (field: string, value: string) => {
    setUpdating(field);
    try {
      const response = await fetch('/api/update-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobLink: job.link, field, value }),
      });

      if (response.ok) {
        if (field === 'Status' && value === 'Offer') {
          celebrateOffer();
        }
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

  const handleEdit = () => {
    setEditFields({
      title: job.title,
      company: job.company,
      location: job.location || '',
      employmentType: job.employmentType || '',
      notes: job.notes || '',
      link: job.link,
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // Update each changed field
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

      // Send all updates
      for (const update of updates) {
        await fetch('/api/update-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            jobLink: job.link,
            field: update.field,
            value: update.value,
          }),
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
          <h3 className="font-semibold text-lg tracking-tight">Edit Job</h3>
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
              <label className="block text-sm font-medium mb-1.5">Employment Type</label>
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
              <label className="block text-sm font-medium mb-1.5">Notes</label>
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
              {saving ? 'Saving...' : 'Save Changes'}
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
            className="p-1.5 rounded-md hover:bg-rose-50 text-sm muted hover:text-rose-700 transition-colors"
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
        <div className="flex items-center gap-2 text-sm">
          <span className="muted">📅</span>
          <input
            type="date"
            value={job.dueDate || ''}
            onChange={(e) => updateField('Due date', e.target.value)}
            disabled={updating === 'Due date'}
            className="table-date"
          />
        </div>

        {/* Status dropdown */}
        <div className="flex items-center gap-2 text-sm">
          <span className="muted">📊</span>
          <select
            value={job.status}
            onChange={(e) => updateField('Status', e.target.value)}
            disabled={updating === 'Status'}
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
                  disabled={updating === col.name}
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
