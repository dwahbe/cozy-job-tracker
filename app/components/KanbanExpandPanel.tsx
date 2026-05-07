'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';
import { dropdownColorClass } from '@/lib/dropdown-colors';
import { celebrateOffer } from '@/lib/confetti';
import {
  statusColor,
  STATUS_OPTIONS,
  formatDateDisplay,
  getFieldValue,
  applyFieldUpdate,
} from '@/lib/job-utils';
import { DueDatePicker } from './DueDatePicker';

interface KanbanExpandPanelProps {
  job: ParsedJob;
  slug: string;
  columns: Column[];
  onClose: () => void;
}

export function KanbanExpandPanel({
  job: serverJob,
  slug,
  columns,
  onClose,
}: KanbanExpandPanelProps) {
  const router = useRouter();
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>({});
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editFields, setEditFields] = useState({
    title: serverJob.title,
    company: serverJob.company,
    location: serverJob.location || '',
    employmentType: serverJob.employmentType || '',
    notes: serverJob.notes || '',
    link: serverJob.link,
    dueDate: serverJob.dueDate || '',
  });

  // Reconcile optimistic state when server data arrives
  useEffect(() => {
    setPendingUpdates((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next: Record<string, string> = {};
      for (const [field, value] of Object.entries(prev)) {
        if (getFieldValue(serverJob, field) !== value) next[field] = value;
      }
      return Object.keys(next).length > 0 ? next : {};
    });
  }, [serverJob]);

  // Sync edit fields when server job changes
  useEffect(() => {
    if (!isEditing) {
      setEditFields({
        title: serverJob.title,
        company: serverJob.company,
        location: serverJob.location || '',
        employmentType: serverJob.employmentType || '',
        notes: serverJob.notes || '',
        link: serverJob.link,
        dueDate: serverJob.dueDate || '',
      });
    }
  }, [serverJob, isEditing]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Effective job with optimistic updates applied
  const job = useMemo(() => {
    if (Object.keys(pendingUpdates).length === 0) return serverJob;
    const ej: ParsedJob = { ...serverJob, customFields: { ...serverJob.customFields } };
    for (const [field, val] of Object.entries(pendingUpdates)) {
      applyFieldUpdate(ej, field, val);
    }
    return ej;
  }, [serverJob, pendingUpdates]);

  const updateField = useCallback(
    async (field: string, value: string) => {
      setPendingUpdates((prev) => ({ ...prev, [field]: value }));
      try {
        const response = await fetch('/api/update-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            jobId: serverJob.id,
            jobLink: serverJob.link,
            field,
            value,
          }),
        });
        if (response.ok) {
          if (field === 'Status' && value === 'Offer') celebrateOffer();
          router.refresh();
        } else {
          setPendingUpdates((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
          });
        }
      } catch {
        setPendingUpdates((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [slug, serverJob.id, serverJob.link, router]
  );

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updates: { field: string; value: string }[] = [];
      if (editFields.title !== serverJob.title)
        updates.push({ field: 'Title', value: editFields.title });
      if (editFields.company !== serverJob.company)
        updates.push({ field: 'Company', value: editFields.company });
      if (editFields.location !== (serverJob.location || ''))
        updates.push({ field: 'Location', value: editFields.location });
      if (editFields.employmentType !== (serverJob.employmentType || ''))
        updates.push({ field: 'Employment type', value: editFields.employmentType });
      if (editFields.notes !== (serverJob.notes || ''))
        updates.push({ field: 'Notes', value: editFields.notes });
      if (editFields.link !== serverJob.link)
        updates.push({ field: 'Link', value: editFields.link });
      if (editFields.dueDate !== (serverJob.dueDate || ''))
        updates.push({ field: 'Due date', value: editFields.dueDate });

      if (updates.length > 0) {
        for (const u of updates) setPendingUpdates((prev) => ({ ...prev, [u.field]: u.value }));
        await fetch('/api/update-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            jobId: serverJob.id,
            jobLink: serverJob.link,
            fields: updates,
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

  const handleDelete = async () => {
    if (!confirm('Move this job to trash?')) return;
    setDeleting(true);
    try {
      const response = await fetch('/api/delete-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobId: serverJob.id, jobLink: serverJob.link || undefined }),
      });
      if (response.ok) {
        onClose();
        router.refresh();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="expand-overlay" onClick={onClose} />
      <div className="expand-panel">
        {/* Header */}
        <div className="expand-panel-header">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-black/5 muted hover:text-black transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editFields.title || !editFields.company}
                  className="btn btn-primary btn-sm"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="btn btn-ghost btn-sm">
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="expand-panel-body">
          {isEditing ? (
            /* ── Edit mode ── */
            <div className="space-y-4">
              <div>
                <label className="expand-field-label">Title</label>
                <input
                  type="text"
                  value={editFields.title}
                  onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="expand-field-label">Company</label>
                <input
                  type="text"
                  value={editFields.company}
                  onChange={(e) => setEditFields({ ...editFields, company: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="expand-field-label">Location</label>
                <input
                  type="text"
                  value={editFields.location}
                  onChange={(e) => setEditFields({ ...editFields, location: e.target.value })}
                  placeholder="e.g. Remote, San Francisco"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="expand-field-label">Employment type</label>
                <input
                  type="text"
                  value={editFields.employmentType}
                  onChange={(e) => setEditFields({ ...editFields, employmentType: e.target.value })}
                  placeholder="e.g. Full-time, Contract"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="expand-field-label">Due date</label>
                <DueDatePicker
                  value={editFields.dueDate}
                  onChange={(value) => setEditFields({ ...editFields, dueDate: value })}
                  placeholder="Set due date"
                  buttonClassName={`input w-full text-left ${editFields.dueDate ? '' : 'muted'}`}
                />
              </div>
              <div>
                <label className="expand-field-label">Link</label>
                <input
                  type="url"
                  value={editFields.link}
                  onChange={(e) => setEditFields({ ...editFields, link: e.target.value })}
                  placeholder="https://..."
                  className="input w-full"
                />
              </div>
              <div>
                <label className="expand-field-label">Salary / notes</label>
                <textarea
                  value={editFields.notes}
                  onChange={(e) => setEditFields({ ...editFields, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="input w-full resize-none"
                />
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <div className="space-y-0.5">
              {/* Title */}
              <h2 className="text-lg font-semibold tracking-tight mb-1">{job.title}</h2>
              <p className="muted mb-4">{job.company}</p>

              {/* Field rows — Airtable-style label + value */}
              <div className="expand-fields">
                <FieldRow label="Status">
                  <select
                    value={job.status}
                    onChange={(e) => updateField('Status', e.target.value)}
                    className={`status-select ${statusColor(job.status)}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                {job.location && <FieldRow label="Location">{job.location}</FieldRow>}

                {job.employmentType && <FieldRow label="Type">{job.employmentType}</FieldRow>}

                <FieldRow label="Due date">
                  <DueDatePicker
                    value={job.dueDate || ''}
                    onChange={(value) => updateField('Due date', value)}
                    placeholder="Set due date"
                  />
                </FieldRow>

                {job.notes && <FieldRow label="Notes">{job.notes}</FieldRow>}

                <FieldRow label="Link">
                  {job.link ? (
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline underline-offset-2 decoration-1 break-all"
                    >
                      View posting ↗
                    </a>
                  ) : (
                    <span className="text-sm muted">No link</span>
                  )}
                </FieldRow>

                {/* Custom columns */}
                {columns.map((col) => (
                  <FieldRow key={col.name} label={col.name}>
                    {col.type === 'checkbox' && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={job.customFields[col.name] === 'Yes'}
                          onChange={(e) => updateField(col.name, e.target.checked ? 'Yes' : 'No')}
                          className="h-4 w-4 accent-accent"
                        />
                        <span className="text-sm">
                          {job.customFields[col.name] === 'Yes' ? 'Yes' : 'No'}
                        </span>
                      </label>
                    )}
                    {col.type === 'dropdown' && col.options && (
                      <select
                        value={job.customFields[col.name] || ''}
                        onChange={(e) => updateField(col.name, e.target.value)}
                        className={`status-select ${dropdownColorClass(col.optionColors?.[job.customFields[col.name]])}`}
                      >
                        <option value="">—</option>
                        {col.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                    {col.type === 'text' && (
                      <input
                        type="text"
                        value={textFields[col.name] ?? job.customFields[col.name] ?? ''}
                        onChange={(e) =>
                          setTextFields((prev) => ({ ...prev, [col.name]: e.target.value }))
                        }
                        onBlur={(e) => {
                          const newValue = e.target.value;
                          const oldValue = job.customFields[col.name] || '';
                          if (newValue !== oldValue) updateField(col.name, newValue);
                          setTextFields((prev) => {
                            const next = { ...prev };
                            delete next[col.name];
                            return next;
                          });
                        }}
                        placeholder="..."
                        className="input py-1.5 text-sm w-full"
                      />
                    )}
                    {col.type === 'date' && (
                      <DueDatePicker
                        value={job.customFields[col.name] || ''}
                        onChange={(value) => updateField(col.name, value)}
                        placeholder="Set date"
                      />
                    )}
                  </FieldRow>
                ))}
              </div>

              {/* Meta + delete */}
              <div className="pt-4 mt-2 flex items-center text-xs muted border-t border-[var(--border)]">
                <span>Added {formatDateDisplay(job.parsedOn) || job.parsedOn}</span>
                <span
                  className={`ml-4 ${job.verified === 'Yes' ? 'text-emerald-700' : 'text-amber-700'}`}
                >
                  {job.verified === 'Yes' ? '✓ Verified' : '⚠ Partial'}
                </span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="expand-delete-btn ml-auto"
                  title="Move to trash"
                >
                  🗑️
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="expand-field-row">
      <div className="expand-field-label">{label}</div>
      <div className="expand-field-value">{children}</div>
    </div>
  );
}
