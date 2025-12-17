'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';

interface JobTableProps {
  jobs: ParsedJob[];
  slug: string;
  columns: Column[];
}

const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

export function JobTable({ jobs, slug, columns }: JobTableProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<{ jobLink: string; field: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [textFields, setTextFields] = useState<Record<string, Record<string, string>>>({});

  const updateField = async (jobLink: string, field: string, value: string) => {
    setUpdating({ jobLink, field });
    try {
      const response = await fetch('/api/update-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, jobLink, field, value }),
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

  const statusColor = (status: string) => ({
    Saved: 'status-saved',
    Applied: 'status-applied',
    Interview: 'status-interview',
    Offer: 'status-offer',
    Rejected: 'status-rejected',
  }[status] || 'status-saved');

  const isUpdating = (jobLink: string, field: string) =>
    updating?.jobLink === jobLink && updating?.field === field;

  return (
    <div className="table-wrapper">
      <table className="job-table">
        <thead>
          <tr>
            <th className="th-title">Position</th>
            <th className="th-company">Company</th>
            <th className="th-location">Location</th>
            <th className="th-status">Status</th>
            <th className="th-due">Due</th>
            {columns.map((col) => (
              <th key={col.name} className="th-custom">{col.name}</th>
            ))}
            <th className="th-date">Added</th>
            <th className="th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.link} className={deleting === job.link ? 'row-deleting' : ''}>
              <td className="td-title">
                <a
                  href={job.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="job-link"
                >
                  {job.title}
                </a>
              </td>
              <td className="td-company">{job.company}</td>
              <td className="td-location">{job.location || '—'}</td>
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
              <td className="td-due">
                <input
                  type="date"
                  value={job.dueDate || ''}
                  onChange={(e) => updateField(job.link, 'Due date', e.target.value)}
                  disabled={isUpdating(job.link, 'Due date')}
                  className="table-date"
                />
              </td>
              {columns.map((col) => (
                <td key={col.name} className="td-custom">
                  {col.type === 'checkbox' && (
                    <input
                      type="checkbox"
                      checked={job.customFields[col.name] === 'Yes'}
                      onChange={(e) => updateField(job.link, col.name, e.target.checked ? 'Yes' : 'No')}
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

