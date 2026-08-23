'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';
import { dropdownColorClass } from '@/lib/dropdown-colors';
import { celebrateOffer } from '@/lib/confetti';
import { statusColor, getFieldValue, applyFieldUpdate, STATUS_OPTIONS } from '@/lib/job-utils';
import { DueDatePicker } from './DueDatePicker';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
      const end = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(end, end);
    }
    // Only run on mount - autoFocus is effectively constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

// Built-in column definitions
const BUILTIN_COLUMNS = [
  { id: '_title', label: 'Title / Link', thClass: 'th-title', tdClass: 'td-title' },
  { id: '_company', label: 'Company', thClass: 'th-company', tdClass: 'td-company' },
  { id: '_location', label: 'Location', thClass: 'th-location', tdClass: 'td-location' },
  { id: '_type', label: 'Type', thClass: 'th-type', tdClass: 'td-type' },
  { id: '_dueDate', label: 'Due date', thClass: 'th-due', tdClass: 'td-due' },
  { id: '_notes', label: 'Salary / notes', thClass: 'th-notes', tdClass: 'td-notes' },
  { id: '_status', label: 'Status', thClass: 'th-status', tdClass: 'td-status' },
] as const;

type BuiltinColumnId = (typeof BUILTIN_COLUMNS)[number]['id'];

function isBuiltinColumn(id: string): id is BuiltinColumnId {
  return BUILTIN_COLUMNS.some((c) => c.id === id);
}

function getBuiltinColumn(id: BuiltinColumnId) {
  return BUILTIN_COLUMNS.find((c) => c.id === id)!;
}

// Draggable table header
function SortableHeader({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <th ref={setNodeRef} style={style} className={className} {...attributes} {...listeners}>
      {children}
    </th>
  );
}

interface JobTableProps {
  jobs: ParsedJob[];
  columns: Column[];
  columnOrder: string[];
  highlightJobId?: string | null;
  onHighlightDone?: () => void;
}

export function JobTable({
  jobs: serverJobs,
  columns,
  columnOrder,
  highlightJobId,
  onHighlightDone,
}: JobTableProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [textFields, setTextFields] = useState<Record<string, Record<string, string>>>({});
  const [editingCell, setEditingCell] = useState<{ jobId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editLinkValue, setEditLinkValue] = useState('');
  const [localOrder, setLocalOrder] = useState(columnOrder);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, Record<string, string>>>({});
  const highlightRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (node) {
        requestAnimationFrame(() => {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    },
    // Re-run when the highlighted job changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlightJobId]
  );

  // Create a map of custom columns for quick lookup
  const customColumnMap = new Map(columns.map((c) => [c.name, c]));

  // Sync local order when prop changes
  useEffect(() => {
    setLocalOrder(columnOrder);
  }, [columnOrder]);

  // Reconcile optimistic state when server data arrives
  useEffect(() => {
    setPendingUpdates((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next: Record<string, Record<string, string>> = {};
      for (const [jobId, fields] of Object.entries(prev)) {
        const serverJob = serverJobs.find((j) => j.id === jobId);
        if (!serverJob) continue;
        const remaining: Record<string, string> = {};
        for (const [field, value] of Object.entries(fields)) {
          if (getFieldValue(serverJob, field) !== value) {
            remaining[field] = value;
          }
        }
        if (Object.keys(remaining).length > 0) {
          next[jobId] = remaining;
        }
      }
      return Object.keys(next).length > 0 ? next : {};
    });
  }, [serverJobs]);

  // Apply optimistic updates for instant UI feedback
  const effectiveJobs = useMemo(() => {
    if (Object.keys(pendingUpdates).length === 0) return serverJobs;
    return serverJobs.map((job) => {
      const updates = pendingUpdates[job.id];
      if (!updates) return job;
      const ej: ParsedJob = { ...job, customFields: { ...job.customFields } };
      for (const [field, val] of Object.entries(updates)) {
        applyFieldUpdate(ej, field, val);
      }
      return ej;
    });
  }, [serverJobs, pendingUpdates]);

  // Shadow prop so existing render code uses optimistic values
  const jobs = effectiveJobs;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - reorder columns
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localOrder.findIndex((id) => id === active.id);
      const newIndex = localOrder.findIndex((id) => id === over.id);

      const newOrder = arrayMove(localOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);

      // Save new order to server
      try {
        const response = await fetch('/api/reorder-columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnOrder: newOrder }),
        });

        if (!response.ok) {
          setLocalOrder(columnOrder); // Revert on error
        } else {
          router.refresh();
        }
      } catch {
        setLocalOrder(columnOrder); // Revert on error
      }
    }
  };

  const revertPendingUpdate = (jobId: string, field: string) => {
    setPendingUpdates((prev) => {
      const next = { ...prev };
      if (next[jobId]) {
        delete next[jobId][field];
        if (Object.keys(next[jobId]).length === 0) delete next[jobId];
      }
      return next;
    });
  };

  const updateField = async (jobId: string, field: string, value: string) => {
    // Optimistic update - UI reflects change immediately
    setPendingUpdates((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], [field]: value },
    }));

    try {
      const response = await fetch('/api/update-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, field, value }),
      });

      if (response.ok) {
        if (field === 'Status' && value === 'Offer') {
          celebrateOffer();
        }
        router.refresh();
      } else {
        revertPendingUpdate(jobId, field);
      }
    } catch (err) {
      console.error('Update failed:', err);
      revertPendingUpdate(jobId, field);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Move this job to trash?')) return;

    setDeleting(jobId);
    try {
      const response = await fetch('/api/delete-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
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

  const startEditing = (
    jobId: string,
    field: string,
    currentValue: string,
    currentLinkUrl?: string
  ) => {
    setEditingCell({ jobId, field });
    setEditValue(currentValue);
    setEditLinkValue(currentLinkUrl ?? '');
  };

  const saveEdit = async (jobId: string, field: string, originalValue: string) => {
    setEditingCell(null);
    if (editValue !== originalValue) {
      await updateField(jobId, field, editValue);
    }
  };

  const saveTitleAndLink = async (jobId: string, originalTitle: string, originalLink: string) => {
    setEditingCell(null);
    const titleChanged = editValue !== originalTitle;
    const linkChanged = editLinkValue !== originalLink;
    if (!titleChanged && !linkChanged) return;

    const fields: { field: string; value: string }[] = [];
    if (titleChanged) fields.push({ field: 'Title', value: editValue });
    if (linkChanged) fields.push({ field: 'Link', value: editLinkValue });

    for (const f of fields) {
      setPendingUpdates((prev) => ({
        ...prev,
        [jobId]: { ...prev[jobId], [f.field]: f.value },
      }));
    }

    try {
      const response = await fetch('/api/update-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, fields }),
      });
      if (response.ok) {
        router.refresh();
      } else {
        for (const f of fields) revertPendingUpdate(jobId, f.field);
      }
    } catch {
      for (const f of fields) revertPendingUpdate(jobId, f.field);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
    setEditLinkValue('');
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    jobId: string,
    field: string,
    originalValue: string
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(jobId, field, originalValue);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const isEditing = (jobId: string, field: string) =>
    editingCell?.jobId === jobId && editingCell?.field === field;

  const EditableCell = ({
    jobId,
    field,
    value,
    placeholder = '—',
    className = '',
  }: {
    jobId: string;
    field: string;
    value: string;
    placeholder?: string;
    className?: string;
  }) => {
    if (isEditing(jobId, field)) {
      return (
        <AutoHeightTextarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(jobId, field, value)}
          onKeyDown={(e) => handleKeyDown(e, jobId, field, value)}
          className="inline-edit"
          autoFocus
        />
      );
    }

    const displayValue = value || placeholder;
    const isEmpty = !value;

    return (
      <span
        onClick={() => startEditing(jobId, field, value)}
        className={`cursor-pointer hover:bg-black/5 px-1 -mx-1 rounded transition-colors ${isEmpty ? 'text-muted-3' : ''} ${className}`}
      >
        {displayValue}
      </span>
    );
  };

  const TitleLinkCell = ({ job }: { job: ParsedJob }) => {
    const editing = isEditing(job.id, 'Title');

    if (editing) {
      return (
        <div className="flex flex-col gap-1.5">
          <AutoHeightTextarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveTitleAndLink(job.id, job.title, job.link);
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
            onBlur={() => {}}
            className="inline-edit"
            autoFocus
          />
          <div className="flex items-center gap-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0 text-muted-3"
            >
              <path
                d="M6.5 11.5h-2a3 3 0 010-6h2M9.5 4.5h2a3 3 0 010 6h-2M5 8h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              value={editLinkValue}
              onChange={(e) => setEditLinkValue(e.target.value)}
              onBlur={() => saveTitleAndLink(job.id, job.title, job.link)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveTitleAndLink(job.id, job.title, job.link);
                } else if (e.key === 'Escape') {
                  cancelEdit();
                }
              }}
              placeholder="https://..."
              className="inline-edit text-xs w-full"
              style={{ color: 'var(--muted-3)', boxShadow: 'none' }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 group/cell">
        {job.title ? (
          job.link ? (
            <a href={job.link} target="_blank" rel="noopener noreferrer" className="job-link">
              {job.title}
            </a>
          ) : (
            <span>{job.title}</span>
          )
        ) : (
          <span className="text-muted-3">—</span>
        )}
        <button
          onClick={() => startEditing(job.id, 'Title', job.title, job.link)}
          className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"
          title="Edit title & link"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-muted-3">
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
  };

  // Get header label for a column
  const getHeaderLabel = (colId: string): string => {
    if (isBuiltinColumn(colId)) {
      return getBuiltinColumn(colId).label;
    }
    return colId; // Custom column name is the label
  };

  // Get header class for a column
  const getHeaderClass = (colId: string): string => {
    if (isBuiltinColumn(colId)) {
      return getBuiltinColumn(colId).thClass;
    }
    return 'th-custom';
  };

  // Render cell for a column
  const renderCell = (job: ParsedJob, colId: string) => {
    if (isBuiltinColumn(colId)) {
      const col = getBuiltinColumn(colId);
      switch (colId) {
        case '_title':
          return (
            <td key={colId} className={col.tdClass}>
              <TitleLinkCell job={job} />
            </td>
          );
        case '_company':
          return (
            <td key={colId} className={col.tdClass}>
              <EditableCell jobId={job.id} field="Company" value={job.company} />
            </td>
          );
        case '_location':
          return (
            <td key={colId} className={col.tdClass}>
              <EditableCell
                jobId={job.id}

                field="Location"
                value={job.location || ''}
              />
            </td>
          );
        case '_type':
          return (
            <td key={colId} className={col.tdClass}>
              <EditableCell
                jobId={job.id}

                field="Employment type"
                value={job.employmentType || ''}
              />
            </td>
          );
        case '_dueDate':
          return (
            <td key={colId} className={col.tdClass}>
              <DueDatePicker
                value={job.dueDate || ''}
                onChange={(value) => updateField(job.id, 'Due date', value)}
              />
            </td>
          );
        case '_notes':
          return (
            <td key={colId} className={col.tdClass}>
              <EditableCell
                jobId={job.id}

                field="Notes"
                value={job.notes || ''}
                className="notes-text"
              />
            </td>
          );
        case '_status':
          return (
            <td key={colId} className={col.tdClass}>
              <select
                value={job.status}
                onChange={(e) => updateField(job.id, 'Status', e.target.value)}
                className={`status-select ${statusColor(job.status)}`}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </td>
          );
      }
    }

    // Custom column
    const customCol = customColumnMap.get(colId);
    if (!customCol)
      return (
        <td key={colId} className="td-custom">
          —
        </td>
      );

    return (
      <td key={colId} className="td-custom">
        {customCol.type === 'checkbox' && (
          <input
            type="checkbox"
            checked={job.customFields[customCol.name] === 'Yes'}
            onChange={(e) => updateField(job.id, customCol.name, e.target.checked ? 'Yes' : 'No')}
            className="table-checkbox"
          />
        )}
        {customCol.type === 'dropdown' && customCol.options && (
          <select
            value={job.customFields[customCol.name] || ''}
            onChange={(e) => updateField(job.id, customCol.name, e.target.value)}
            className={`table-select ${dropdownColorClass(customCol.optionColors?.[job.customFields[customCol.name]])}`}
          >
            <option value="">—</option>
            {customCol.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
        {customCol.type === 'date' && (
          <DueDatePicker
            value={job.customFields[customCol.name] || ''}
            onChange={(v) => updateField(job.id, customCol.name, v)}
          />
        )}
        {customCol.type === 'text' && (
          <input
            type="text"
            value={textFields[job.id]?.[customCol.name] ?? job.customFields[customCol.name] ?? ''}
            onChange={(e) =>
              setTextFields((prev) => ({
                ...prev,
                [job.id]: { ...prev[job.id], [customCol.name]: e.target.value },
              }))
            }
            onBlur={(e) => {
              const newValue = e.target.value;
              const oldValue = job.customFields[customCol.name] || '';
              if (newValue !== oldValue) {
                updateField(job.id, customCol.name, newValue);
              }
              setTextFields((prev) => {
                const next = { ...prev };
                if (next[job.id]) {
                  delete next[job.id][customCol.name];
                }
                return next;
              });
            }}
            placeholder="..."
            className="table-input"
          />
        )}
      </td>
    );
  };

  return (
    <DndContext
      id="job-table-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="table-wrapper">
        <table className="job-table">
          <thead>
            <tr>
              <SortableContext items={localOrder} strategy={horizontalListSortingStrategy}>
                {localOrder.map((colId) => (
                  <SortableHeader key={colId} id={colId} className={getHeaderClass(colId)}>
                    {getHeaderLabel(colId)}
                  </SortableHeader>
                ))}
              </SortableContext>
              <th className="th-date">Added</th>
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const isHighlighted = job.id === highlightJobId;
              return (
                <tr
                  key={job.id}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={`${deleting === job.id ? 'row-deleting' : ''} ${isHighlighted ? 'row-highlight' : ''}`}
                  onAnimationEnd={isHighlighted ? onHighlightDone : undefined}
                >
                  {localOrder.map((colId) => renderCell(job, colId))}
                  <td className="td-date">
                    <span className="date-text">{job.parsedOn}</span>
                  </td>
                  <td className="td-actions">
                    <button
                      onClick={() => handleDelete(job.id)}
                      disabled={deleting === job.id}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}
