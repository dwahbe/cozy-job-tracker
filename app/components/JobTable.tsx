'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';
import { celebrateOffer } from '@/lib/confetti';

interface JobTableProps {
  jobs: ParsedJob[];
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

export function JobTable({ jobs, slug, columns }: JobTableProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<{ jobLink: string; field: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [textFields, setTextFields] = useState<Record<string, Record<string, string>>>({});
  const [editingJob, setEditingJob] = useState<ParsedJob | null>(null);
  const [editFields, setEditFields] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);

  const updateField = async (jobLink: string, field: string, value: string) => {
    setUpdating({ jobLink, field });
    try {
      const response = await fetch('/api/update-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobLink, field, value }),
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

  const handleDelete = async (jobLink: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    setDeleting(jobLink);
    try {
      const response = await fetch('/api/delete-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobLink }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (job: ParsedJob) => {
    setEditingJob(job);
    setEditFields({
      title: job.title,
      company: job.company,
      location: job.location || '',
      employmentType: job.employmentType || '',
      notes: job.notes || '',
      link: job.link,
    });
  };

  const handleCancelEdit = () => {
    setEditingJob(null);
    setEditFields(null);
  };

  const handleSaveEdit = async () => {
    if (!editingJob || !editFields) return;

    setSaving(true);
    try {
      const updates: { field: string; value: string }[] = [];

      if (editFields.title !== editingJob.title) {
        updates.push({ field: 'Title', value: editFields.title });
      }
      if (editFields.company !== editingJob.company) {
        updates.push({ field: 'Company', value: editFields.company });
      }
      if (editFields.location !== (editingJob.location || '')) {
        updates.push({ field: 'Location', value: editFields.location });
      }
      if (editFields.employmentType !== (editingJob.employmentType || '')) {
        updates.push({ field: 'Employment type', value: editFields.employmentType });
      }
      if (editFields.notes !== (editingJob.notes || '')) {
        updates.push({ field: 'Notes', value: editFields.notes });
      }
      if (editFields.link !== editingJob.link) {
        updates.push({ field: 'Link', value: editFields.link });
      }

      for (const update of updates) {
        await fetch('/api/update-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            jobLink: editingJob.link,
            field: update.field,
            value: update.value,
          }),
        });
      }

      setEditingJob(null);
      setEditFields(null);
      router.refresh();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (status: string) =>
    ({
      Saved: 'status-saved',
      Applied: 'status-applied',
      Interview: 'status-interview',
      Offer: 'status-offer',
      Rejected: 'status-rejected',
    })[status] || 'status-saved';

  const isUpdating = (jobLink: string, field: string) =>
    updating?.jobLink === jobLink && updating?.field === field;

  return (
    <>
      {/* Edit Modal */}
      {editingJob && editFields && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                    onChange={(e) =>
                      setEditFields({ ...editFields, employmentType: e.target.value })
                    }
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
        </div>
      )}

      <div className="table-wrapper">
        <table className="job-table">
          <thead>
            <tr>
              <th className="th-title">Title</th>
              <th className="th-company">Company</th>
              <th className="th-location">Location</th>
              <th className="th-type">Type</th>
              <th className="th-due">Due Date</th>
              <th className="th-notes">Notes</th>
              <th className="th-status">Status</th>
              {columns.map((col) => (
                <th key={col.name} className="th-custom">
                  {col.name}
                </th>
              ))}
              <th className="th-date">Added</th>
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.link} className={deleting === job.link ? 'row-deleting' : ''}>
                <td className="td-title">
                  <a href={job.link} target="_blank" rel="noopener noreferrer" className="job-link">
                    {job.title}
                  </a>
                </td>
                <td className="td-company">{job.company}</td>
                <td className="td-location">{job.location || '—'}</td>
                <td className="td-type">{job.employmentType || '—'}</td>
                <td className="td-due">
                  <input
                    type="date"
                    value={job.dueDate || ''}
                    onChange={(e) => updateField(job.link, 'Due date', e.target.value)}
                    disabled={isUpdating(job.link, 'Due date')}
                    className="table-date"
                  />
                </td>
                <td className="td-notes">
                  <span className="notes-text" title={job.notes || ''}>
                    {job.notes || '—'}
                  </span>
                </td>
                <td className="td-status">
                  <select
                    value={job.status}
                    onChange={(e) => updateField(job.link, 'Status', e.target.value)}
                    disabled={isUpdating(job.link, 'Status')}
                    className={`status-select ${statusColor(job.status)}`}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                {columns.map((col) => (
                  <td key={col.name} className="td-custom">
                    {col.type === 'checkbox' && (
                      <input
                        type="checkbox"
                        checked={job.customFields[col.name] === 'Yes'}
                        onChange={(e) =>
                          updateField(job.link, col.name, e.target.checked ? 'Yes' : 'No')
                        }
                        disabled={isUpdating(job.link, col.name)}
                        className="table-checkbox"
                      />
                    )}
                    {col.type === 'dropdown' && col.options && (
                      <select
                        value={job.customFields[col.name] || ''}
                        onChange={(e) => updateField(job.link, col.name, e.target.value)}
                        disabled={isUpdating(job.link, col.name)}
                        className="table-select"
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
                        value={textFields[job.link]?.[col.name] ?? job.customFields[col.name] ?? ''}
                        onChange={(e) =>
                          setTextFields((prev) => ({
                            ...prev,
                            [job.link]: { ...prev[job.link], [col.name]: e.target.value },
                          }))
                        }
                        onBlur={(e) => {
                          const newValue = e.target.value;
                          const oldValue = job.customFields[col.name] || '';
                          if (newValue !== oldValue) {
                            updateField(job.link, col.name, newValue);
                          }
                          setTextFields((prev) => {
                            const next = { ...prev };
                            if (next[job.link]) {
                              delete next[job.link][col.name];
                            }
                            return next;
                          });
                        }}
                        disabled={isUpdating(job.link, col.name)}
                        placeholder="..."
                        className="table-input"
                      />
                    )}
                  </td>
                ))}
                <td className="td-date">
                  <span className="date-text">{job.parsedOn}</span>
                </td>
                <td className="td-actions">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(job)} className="edit-btn" title="Edit job">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M10.5 1.5l2 2-7.5 7.5H3v-2l7.5-7.5zM8.5 3.5l2 2"
                          stroke="currentColor"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(job.link)}
                      disabled={deleting === job.link}
                      className="delete-btn"
                      title="Delete job"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2 3.5h10M5.5 3.5V2a1 1 0 011-1h1a1 1 0 011 1v1.5M11 3.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V3.5"
                          stroke="currentColor"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
