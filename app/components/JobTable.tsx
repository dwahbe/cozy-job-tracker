'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';
import { celebrateOffer } from '@/lib/confetti';

// Auto-height textarea that stays within column width
function AutoHeightTextarea({
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    resize();
  }, [resize, value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e);
        resize();
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={className}
      rows={1}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  );
}

interface JobTableProps {
  jobs: ParsedJob[];
  slug: string;
  columns: Column[];
}

const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  const ordinal = (n: number) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  return `${month} ${day}${ordinal(day)} ${year}`;
};

export function JobTable({ jobs, slug, columns }: JobTableProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<{ jobLink: string; field: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [textFields, setTextFields] = useState<Record<string, Record<string, string>>>({});
  const [editingCell, setEditingCell] = useState<{ jobLink: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

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

  const startEditing = (jobLink: string, field: string, currentValue: string) => {
    setEditingCell({ jobLink, field });
    setEditValue(currentValue);
  };

  const saveEdit = async (jobLink: string, field: string, originalValue: string) => {
    setEditingCell(null);
    if (editValue !== originalValue) {
      await updateField(jobLink, field, editValue);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, jobLink: string, field: string, originalValue: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(jobLink, field, originalValue);
    } else if (e.key === 'Escape') {
      cancelEdit();
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

  const isEditing = (jobLink: string, field: string) =>
    editingCell?.jobLink === jobLink && editingCell?.field === field;

  const EditableCell = ({
    jobLink,
    field,
    value,
    placeholder = '—',
    className = '',
    isLink = false,
    linkHref = '',
  }: {
    jobLink: string;
    field: string;
    value: string;
    placeholder?: string;
    className?: string;
    isLink?: boolean;
    linkHref?: string;
  }) => {
    if (isEditing(jobLink, field)) {
      return (
        <AutoHeightTextarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(jobLink, field, value)}
          onKeyDown={(e) => handleKeyDown(e, jobLink, field, value)}
          className="inline-edit"
          autoFocus
        />
      );
    }

    const displayValue = value || placeholder;
    const isEmpty = !value;

    if (isLink && value) {
      return (
        <div className="flex items-center gap-1.5 group/cell">
          <a href={linkHref} target="_blank" rel="noopener noreferrer" className="job-link">
            {displayValue}
          </a>
          <button
            onClick={() => startEditing(jobLink, field, value)}
            className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"
            title="Edit"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-gray-400">
              <path
                d="M10.5 1.5l2 2-7.5 7.5H3v-2l7.5-7.5zM8.5 3.5l2 2"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <span
        onClick={() => startEditing(jobLink, field, value)}
        className={`cursor-pointer hover:bg-black/5 px-1 -mx-1 rounded transition-colors ${isEmpty ? 'text-gray-400' : ''} ${className}`}
      >
        {displayValue}
      </span>
    );
  };

  return (
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
                <EditableCell
                  jobLink={job.link}
                  field="Title"
                  value={job.title}
                  isLink
                  linkHref={job.link}
                />
              </td>
              <td className="td-company">
                <EditableCell jobLink={job.link} field="Company" value={job.company} />
              </td>
              <td className="td-location">
                <EditableCell jobLink={job.link} field="Location" value={job.location || ''} />
              </td>
              <td className="td-type">
                <EditableCell jobLink={job.link} field="Employment type" value={job.employmentType || ''} />
              </td>
              <td className="td-due">
                <label className="relative cursor-pointer group inline-block">
                  <span className="group-hover:underline underline-offset-2 whitespace-nowrap">
                    {job.dueDate ? formatDateDisplay(job.dueDate) : '—'}
                  </span>
                  <input
                    type="date"
                    value={job.dueDate || ''}
                    onChange={(e) => updateField(job.link, 'Due date', e.target.value)}
                    disabled={isUpdating(job.link, 'Due date')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </td>
              <td className="td-notes">
                <EditableCell
                  jobLink={job.link}
                  field="Notes"
                  value={job.notes || ''}
                  className="notes-text"
                />
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
