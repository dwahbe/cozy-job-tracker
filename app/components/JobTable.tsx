'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedJob, Column } from '@/lib/markdown';
import { celebrateOffer } from '@/lib/confetti';
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
      textareaRef.current.select();
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
  { id: '_title', label: 'Title', thClass: 'th-title', tdClass: 'td-title' },
  { id: '_company', label: 'Company', thClass: 'th-company', tdClass: 'td-company' },
  { id: '_location', label: 'Location', thClass: 'th-location', tdClass: 'td-location' },
  { id: '_type', label: 'Type', thClass: 'th-type', tdClass: 'td-type' },
  { id: '_dueDate', label: 'Due Date', thClass: 'th-due', tdClass: 'td-due' },
  { id: '_notes', label: 'Salary / Notes', thClass: 'th-notes', tdClass: 'td-notes' },
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
  slug: string;
  columns: Column[];
  columnOrder: string[];
}

const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
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

  const displayText = value ? formatDateDisplay(value) : '—';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="hover:underline underline-offset-2 text-left whitespace-nowrap"
      >
        {displayText}
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-black/10 rounded-lg shadow-lg p-3 min-w-[200px]"
        >
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
                value === 'rolling' ? 'bg-amber-100 text-amber-800' : 'hover:bg-black/5'
              }`}
            >
              🔄 Rolling basis
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-black/5 transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function JobTable({ jobs, slug, columns, columnOrder }: JobTableProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<{ jobLink: string; field: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [textFields, setTextFields] = useState<Record<string, Record<string, string>>>({});
  const [editingCell, setEditingCell] = useState<{ jobLink: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [localOrder, setLocalOrder] = useState(columnOrder);

  // Create a map of custom columns for quick lookup
  const customColumnMap = new Map(columns.map((c) => [c.name, c]));

  // Sync local order when prop changes
  useEffect(() => {
    setLocalOrder(columnOrder);
  }, [columnOrder]);

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
          body: JSON.stringify({ slug, columnOrder: newOrder }),
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

  const handleKeyDown = (
    e: React.KeyboardEvent,
    jobLink: string,
    field: string,
    originalValue: string
  ) => {
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
              <EditableCell
                jobLink={job.link}
                field="Title"
                value={job.title}
                isLink
                linkHref={job.link}
              />
            </td>
          );
        case '_company':
          return (
            <td key={colId} className={col.tdClass}>
              <EditableCell jobLink={job.link} field="Company" value={job.company} />
            </td>
          );
        case '_location':
          return (
            <td key={colId} className={col.tdClass}>
              <EditableCell jobLink={job.link} field="Location" value={job.location || ''} />
            </td>
          );
        case '_type':
          return (
            <td key={colId} className={col.tdClass}>
              <EditableCell
                jobLink={job.link}
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
                onChange={(value) => updateField(job.link, 'Due date', value)}
                disabled={isUpdating(job.link, 'Due date')}
              />
            </td>
          );
        case '_notes':
          return (
            <td key={colId} className={col.tdClass}>
              <EditableCell
                jobLink={job.link}
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
            onChange={(e) => updateField(job.link, customCol.name, e.target.checked ? 'Yes' : 'No')}
            disabled={isUpdating(job.link, customCol.name)}
            className="table-checkbox"
          />
        )}
        {customCol.type === 'dropdown' && customCol.options && (
          <select
            value={job.customFields[customCol.name] || ''}
            onChange={(e) => updateField(job.link, customCol.name, e.target.value)}
            disabled={isUpdating(job.link, customCol.name)}
            className="table-select"
          >
            <option value="">—</option>
            {customCol.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
        {customCol.type === 'text' && (
          <input
            type="text"
            value={textFields[job.link]?.[customCol.name] ?? job.customFields[customCol.name] ?? ''}
            onChange={(e) =>
              setTextFields((prev) => ({
                ...prev,
                [job.link]: { ...prev[job.link], [customCol.name]: e.target.value },
              }))
            }
            onBlur={(e) => {
              const newValue = e.target.value;
              const oldValue = job.customFields[customCol.name] || '';
              if (newValue !== oldValue) {
                updateField(job.link, customCol.name, newValue);
              }
              setTextFields((prev) => {
                const next = { ...prev };
                if (next[job.link]) {
                  delete next[job.link][customCol.name];
                }
                return next;
              });
            }}
            disabled={isUpdating(job.link, customCol.name)}
            placeholder="..."
            className="table-input"
          />
        )}
      </td>
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
            {jobs.map((job) => (
              <tr key={job.link} className={deleting === job.link ? 'row-deleting' : ''}>
                {localOrder.map((colId) => renderCell(job, colId))}
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
    </DndContext>
  );
}
