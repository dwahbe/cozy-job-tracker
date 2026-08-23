'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Column } from '@/lib/markdown';
import { dropdownColorClass } from '@/lib/dropdown-colors';
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

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CellHelpers<T> {
  isEditing: boolean;
  editValue: string;
  editLinkValue: string;
  setEditValue: (v: string) => void;
  setEditLinkValue: (v: string) => void;
  startEdit: (id: string, field: string, value: string, linkValue?: string) => void;
  saveEdit: () => void;
  saveLinkEdit: () => void;
  cancelEdit: () => void;
  updateField: (id: string, field: string, value: string) => Promise<boolean>;
  item: T;
}

export interface BoardColumnDef<T> {
  id: string;
  label: string;
  field: string;
  type: 'text' | 'link' | 'select' | 'date' | 'checkbox' | 'readonly' | 'custom';
  getValue: (item: T) => string;
  getLinkUrl?: (item: T) => string;
  linkField?: string;
  linkDisplayTransform?: (url: string) => string | null;
  options?: { value: string; label: string }[];
  optionColorClass?: (value: string) => string;
  render?: (item: T, helpers: CellHelpers<T>) => ReactNode;
  thClass?: string;
  tdClass?: string;
  /** If true, the column header label gets a bold / primary style */
  primaryColumn?: boolean;
}

export interface BoardTableProps<T> {
  items: T[];
  getItemId: (item: T) => string;
  builtinColumns: BoardColumnDef<T>[];
  customColumns: Column[];
  getCustomField: (item: T, name: string) => string;
  columnOrder: string[];
  onUpdateField: (id: string, field: string, value: string) => Promise<boolean>;
  onUpdateFields?: (id: string, fields: { field: string; value: string }[]) => Promise<boolean>;
  onDeleteItem: (id: string) => Promise<boolean>;
  onReorderColumns: (order: string[]) => Promise<boolean>;
  deleteConfirmMessage?: string;
  highlightId?: string | null;
  onHighlightDone?: () => void;
  tableClassName?: string;
  getDateAdded?: (item: T) => string;
  dateAddedLabel?: string;
  /** Called after a successful field update (e.g. for confetti) */
  onFieldUpdated?: (id: string, field: string, value: string) => void;
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function AutoHeightTextarea({
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    resize();
  }, [resize, value]);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      const end = ref.current.value.length;
      ref.current.setSelectionRange(end, end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <textarea
      ref={ref}
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

function SortableHeader({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
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

function extractLinkedInUsername(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!parsed.hostname.includes('linkedin.com')) return null;
    const match = parsed.pathname.match(/\/in\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// SVG icons used in the table
const LinkedInIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#0A66C2" className="shrink-0">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.064 2.064 0 1 1 0-4.128 2.064 2.064 0 0 1 0 4.128zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const LinkIcon = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-muted-3">
    <path
      d="M6.5 11.5h-2a3 3 0 010-6h2M9.5 4.5h2a3 3 0 010 6h-2M5 8h6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const EditIcon = (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-muted-3">
    <path
      d="M10.5 1.5l2 2-7.5 7.5H3v-2l7.5-7.5zM8.5 3.5l2 2"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M2 3.5h10M5.5 3.5V2a1 1 0 011-1h1a1 1 0 011 1v1.5M11 3.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V3.5"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// BoardTable
// ---------------------------------------------------------------------------

export function BoardTable<T>({
  items: serverItems,
  getItemId,
  builtinColumns,
  customColumns,
  getCustomField,
  columnOrder,
  onUpdateField,
  onUpdateFields,
  onDeleteItem,
  onReorderColumns,
  deleteConfirmMessage = 'Delete this item?',
  highlightId,
  onHighlightDone,
  tableClassName = '',
  getDateAdded,
  dateAddedLabel = 'Added',
  onFieldUpdated,
}: BoardTableProps<T>) {
  const router = useRouter();

  // -- editing state --------------------------------------------------------
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editLinkValue, setEditLinkValue] = useState('');

  // -- optimistic updates ---------------------------------------------------
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, Record<string, string>>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState(columnOrder);

  // -- custom text field local state (for typing without blur flicker) ------
  const [textFields, setTextFields] = useState<Record<string, Record<string, string>>>({});

  const builtinMap = useMemo(() => new Map(builtinColumns.map((c) => [c.id, c])), [builtinColumns]);
  const customMap = useMemo(() => new Map(customColumns.map((c) => [c.name, c])), [customColumns]);

  // Sync local order with prop
  useEffect(() => {
    setLocalOrder(columnOrder);
  }, [columnOrder]);

  // Reconcile optimistic state when server data arrives
  useEffect(() => {
    setPendingUpdates((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next: Record<string, Record<string, string>> = {};
      for (const [itemId, fields] of Object.entries(prev)) {
        const item = serverItems.find((i) => getItemId(i) === itemId);
        if (!item) continue;
        const remaining: Record<string, string> = {};
        for (const [field, value] of Object.entries(fields)) {
          const col = builtinMap.get(builtinColumns.find((c) => c.field === field)?.id ?? '');
          const serverVal = col ? col.getValue(item) : getCustomField(item, field);
          if (serverVal !== value) {
            remaining[field] = value;
          }
        }
        if (Object.keys(remaining).length > 0) {
          next[itemId] = remaining;
        }
      }
      return Object.keys(next).length > 0 ? next : {};
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverItems]);

  // Compute effective items with optimistic overrides
  const items = useMemo(() => {
    if (Object.keys(pendingUpdates).length === 0) return serverItems;
    return serverItems.map((item) => {
      const id = getItemId(item);
      const updates = pendingUpdates[id];
      if (!updates) return item;
      // Shallow clone — overrides are read via getEffectiveValue, not mutations
      return item;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverItems, pendingUpdates]);

  function getEffectiveValue(item: T, col: BoardColumnDef<T>): string {
    const id = getItemId(item);
    const override = pendingUpdates[id]?.[col.field];
    return override !== undefined ? override : col.getValue(item);
  }

  function getEffectiveCustomValue(item: T, fieldName: string): string {
    const id = getItemId(item);
    const override = pendingUpdates[id]?.[fieldName];
    return override !== undefined ? override : getCustomField(item, fieldName);
  }

  // -- DnD ------------------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localOrder.findIndex((id) => id === active.id);
      const newIndex = localOrder.findIndex((id) => id === over.id);
      const newOrder = arrayMove(localOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);

      const ok = await onReorderColumns(newOrder);
      if (!ok) setLocalOrder(columnOrder);
      else router.refresh();
    }
  };

  // -- highlight ------------------------------------------------------------
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  useEffect(() => {
    if (!highlightId) return;
    rowRefs.current.get(highlightId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId]);

  // -- editing helpers ------------------------------------------------------
  const isEditingCell = (id: string, field: string) =>
    editingCell?.id === id && editingCell?.field === field;

  const startEditing = (id: string, field: string, value: string, linkValue?: string) => {
    setEditingCell({ id, field });
    setEditValue(value);
    setEditLinkValue(linkValue ?? '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
    setEditLinkValue('');
  };

  const revertPendingUpdate = (itemId: string, field: string) => {
    setPendingUpdates((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId][field];
        if (Object.keys(next[itemId]).length === 0) delete next[itemId];
      }
      return next;
    });
  };

  const doUpdateField = async (itemId: string, field: string, value: string): Promise<boolean> => {
    setPendingUpdates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));

    const ok = await onUpdateField(itemId, field, value);
    if (ok) {
      onFieldUpdated?.(itemId, field, value);
      router.refresh();
    } else {
      revertPendingUpdate(itemId, field);
    }
    return ok;
  };

  const saveEdit = async (itemId: string, field: string, originalValue: string) => {
    setEditingCell(null);
    if (editValue !== originalValue) {
      await doUpdateField(itemId, field, editValue);
    }
  };

  const saveLinkEdit = async (
    itemId: string,
    titleField: string,
    linkField: string,
    originalTitle: string,
    originalLink: string
  ) => {
    setEditingCell(null);
    const titleChanged = editValue !== originalTitle;
    const linkChanged = editLinkValue !== originalLink;
    if (!titleChanged && !linkChanged) return;

    const fields: { field: string; value: string }[] = [];
    if (titleChanged) fields.push({ field: titleField, value: editValue });
    if (linkChanged) fields.push({ field: linkField, value: editLinkValue });

    for (const f of fields) {
      setPendingUpdates((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], [f.field]: f.value },
      }));
    }

    if (onUpdateFields) {
      const ok = await onUpdateFields(itemId, fields);
      if (ok) {
        router.refresh();
      } else {
        for (const f of fields) revertPendingUpdate(itemId, f.field);
      }
    } else {
      for (const f of fields) {
        const ok = await onUpdateField(itemId, f.field, f.value);
        if (!ok) revertPendingUpdate(itemId, f.field);
      }
      router.refresh();
    }
  };

  const handleKeyDown = (
    e: KeyboardEvent,
    itemId: string,
    field: string,
    originalValue: string
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit(itemId, field, originalValue);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleLinkKeyDown = (
    e: KeyboardEvent,
    itemId: string,
    titleField: string,
    linkField: string,
    originalTitle: string,
    originalLink: string
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveLinkEdit(itemId, titleField, linkField, originalTitle, originalLink);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm(deleteConfirmMessage)) return;
    setDeleting(itemId);
    const ok = await onDeleteItem(itemId);
    if (ok) router.refresh();
    setDeleting(null);
  };

  // -- cell renderers -------------------------------------------------------

  const renderLinkCell = (item: T, col: BoardColumnDef<T>) => {
    const id = getItemId(item);
    const displayValue = getEffectiveValue(item, col);
    const linkUrl = col.getLinkUrl
      ? col.getLinkUrl(item)
      : (pendingUpdates[id]?.[col.linkField ?? ''] ?? displayValue);
    const editing = isEditingCell(id, col.field);
    const titleField = col.field;
    const linkField = col.linkField ?? col.field;

    if (editing) {
      if (!col.linkField) {
        return (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(id, col.field, displayValue)}
            onKeyDown={(e) => handleKeyDown(e, id, col.field, displayValue)}
            placeholder="https://..."
            className="inline-edit text-xs"
            autoFocus
          />
        );
      }
      return (
        <div className="flex flex-col gap-1.5">
          <AutoHeightTextarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) =>
              handleLinkKeyDown(e, id, titleField, linkField, displayValue, linkUrl)
            }
            onBlur={() => {}}
            className="inline-edit"
            autoFocus
          />
          <div className="flex items-center gap-1">
            {LinkIcon}
            <input
              type="text"
              value={editLinkValue}
              onChange={(e) => setEditLinkValue(e.target.value)}
              onBlur={() => saveLinkEdit(id, titleField, linkField, displayValue, linkUrl)}
              onKeyDown={(e) =>
                handleLinkKeyDown(e, id, titleField, linkField, displayValue, linkUrl)
              }
              placeholder="https://..."
              className="inline-edit text-xs w-full"
              style={{ color: 'var(--muted-3)', boxShadow: 'none' }}
            />
          </div>
        </div>
      );
    }

    if (!col.linkField) {
      if (!displayValue) {
        return (
          <span
            onClick={() => startEditing(id, col.field, '')}
            className="text-muted-3 text-xs block py-1 px-1 -mx-1 cursor-pointer hover:bg-black/5 rounded transition-colors"
          >
            —
          </span>
        );
      }
      const href = displayValue.startsWith('http') ? displayValue : `https://${displayValue}`;
      const linkedInName = extractLinkedInUsername(displayValue);
      if (linkedInName) {
        return (
          <div className="flex items-center gap-1.5 group/cell">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs hover:underline underline-offset-2"
              title={displayValue}
            >
              {LinkedInIcon}
              <span>{linkedInName}</span>
            </a>
            <button
              onClick={() => startEditing(id, col.field, displayValue)}
              className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"
              title="Edit URL"
            >
              {EditIcon}
            </button>
          </div>
        );
      }
      const cleanUrl = displayValue.replace(/^https?:\/\/(www\.)?/, '');
      return (
        <div className="flex items-center gap-1.5 group/cell">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-accent hover:underline text-xs truncate max-w-[140px]"
            title={displayValue}
          >
            {cleanUrl}
          </a>
          <button
            onClick={() => startEditing(id, col.field, displayValue)}
            className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"
            title="Edit URL"
          >
            {EditIcon}
          </button>
        </div>
      );
    }

    // Two-field link (title + URL, like job board's TitleLinkCell)
    return (
      <div className="flex items-center gap-1.5 group/cell">
        {displayValue ? (
          <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="job-link">
            {displayValue}
          </a>
        ) : (
          <span className="text-muted-3">—</span>
        )}
        <button
          onClick={() => startEditing(id, col.field, displayValue, linkUrl)}
          className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"
          title="Edit"
        >
          {EditIcon}
        </button>
      </div>
    );
  };

  const renderSelectCell = (item: T, col: BoardColumnDef<T>) => {
    const id = getItemId(item);
    const value = getEffectiveValue(item, col);
    const colorCls = col.optionColorClass ? col.optionColorClass(value) : '';

    return (
      <select
        value={value}
        onChange={(e) => doUpdateField(id, col.field, e.target.value)}
        className={`board-select ${colorCls}`}
        onClick={(e) => e.stopPropagation()}
        aria-label={col.label}
      >
        {col.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const renderDateCell = (item: T, col: BoardColumnDef<T>) => {
    const id = getItemId(item);
    const value = getEffectiveValue(item, col);

    return (
      <DueDatePicker
        value={value}
        onChange={(v) => doUpdateField(id, col.field, v)}
        allowRolling={false}
        buttonClassName={`hover:underline underline-offset-2 text-left whitespace-nowrap${value ? '' : ' text-muted-3'}`}
      />
    );
  };

  const renderCheckboxCell = (item: T, col: BoardColumnDef<T>) => {
    const id = getItemId(item);
    const value = getEffectiveValue(item, col);

    return (
      <label className="flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={value === 'Yes'}
          onChange={(e) => doUpdateField(id, col.field, e.target.checked ? 'Yes' : 'No')}
          className="table-checkbox"
        />
      </label>
    );
  };

  const renderTextCell = (item: T, col: BoardColumnDef<T>) => {
    const id = getItemId(item);
    const value = getEffectiveValue(item, col);
    const editing = isEditingCell(id, col.field);

    return (
      <input
        type="text"
        value={editing ? editValue : value}
        placeholder="—"
        readOnly={!editing}
        onChange={editing ? (e) => setEditValue(e.target.value) : undefined}
        onBlur={editing ? () => saveEdit(id, col.field, value) : undefined}
        onKeyDown={editing ? (e) => handleKeyDown(e, id, col.field, value) : undefined}
        onFocus={!editing ? () => startEditing(id, col.field, value) : undefined}
        className={`board-cell-input ${col.primaryColumn ? 'font-medium' : ''} ${editing ? 'board-cell-input-active' : ''}`}
      />
    );
  };

  const renderBuiltinCell = (item: T, col: BoardColumnDef<T>) => {
    const id = getItemId(item);

    if (col.type === 'custom' && col.render) {
      const helpers: CellHelpers<T> = {
        isEditing: isEditingCell(id, col.field),
        editValue,
        editLinkValue,
        setEditValue,
        setEditLinkValue,
        startEdit: startEditing,
        saveEdit: () => saveEdit(id, col.field, col.getValue(item)),
        saveLinkEdit: () => {},
        cancelEdit,
        updateField: doUpdateField,
        item,
      };
      return col.render(item, helpers);
    }

    switch (col.type) {
      case 'link':
        return renderLinkCell(item, col);
      case 'select':
        return renderSelectCell(item, col);
      case 'date':
        return renderDateCell(item, col);
      case 'checkbox':
        return renderCheckboxCell(item, col);
      case 'readonly':
        return <span className="text-xs">{col.getValue(item) || '—'}</span>;
      case 'text':
      default:
        return renderTextCell(item, col);
    }
  };

  const renderCustomCell = (item: T, customCol: Column) => {
    const id = getItemId(item);
    const fieldName = customCol.name;
    const value = getEffectiveCustomValue(item, fieldName);

    if (customCol.type === 'checkbox') {
      return (
        <label className="flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={value === 'Yes'}
            onChange={(e) => doUpdateField(id, fieldName, e.target.checked ? 'Yes' : 'No')}
            className="table-checkbox"
          />
        </label>
      );
    }

    if (customCol.type === 'date') {
      return (
        <DueDatePicker
          value={value}
          onChange={(v) => doUpdateField(id, fieldName, v)}
          allowRolling={false}
          buttonClassName={`hover:underline underline-offset-2 text-left whitespace-nowrap${value ? '' : ' text-muted-3'}`}
        />
      );
    }

    if (customCol.type === 'dropdown' && customCol.options) {
      const colorCls = dropdownColorClass(customCol.optionColors?.[value]);
      return (
        <select
          value={value}
          onChange={(e) => doUpdateField(id, fieldName, e.target.value)}
          className={`board-select ${colorCls}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={fieldName}
        >
          <option value="">—</option>
          {customCol.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    // Text — use local textFields state to avoid blur flicker
    const localVal = textFields[id]?.[fieldName];
    return (
      <input
        type="text"
        value={localVal ?? value}
        onChange={(e) =>
          setTextFields((prev) => ({
            ...prev,
            [id]: { ...prev[id], [fieldName]: e.target.value },
          }))
        }
        onBlur={(e) => {
          const newVal = e.target.value;
          if (newVal !== getCustomField(item, fieldName)) {
            doUpdateField(id, fieldName, newVal);
          }
          setTextFields((prev) => {
            const next = { ...prev };
            if (next[id]) {
              delete next[id][fieldName];
              if (Object.keys(next[id]).length === 0) delete next[id];
            }
            return next;
          });
        }}
        placeholder="..."
        className="table-input"
      />
    );
  };

  // -- column resolution ----------------------------------------------------

  const renderCell = (item: T, colId: string) => {
    const builtin = builtinMap.get(colId);
    if (builtin) {
      return (
        <td key={colId} className={builtin.tdClass}>
          {renderBuiltinCell(item, builtin)}
        </td>
      );
    }

    const custom = customMap.get(colId);
    if (custom) {
      return (
        <td key={colId} className="td-custom">
          {renderCustomCell(item, custom)}
        </td>
      );
    }

    return (
      <td key={colId} className="td-custom">
        —
      </td>
    );
  };

  const getHeaderLabel = (colId: string): string => {
    const builtin = builtinMap.get(colId);
    if (builtin) return builtin.label;
    return colId;
  };

  const getHeaderClass = (colId: string): string => {
    const builtin = builtinMap.get(colId);
    if (builtin) return builtin.thClass ?? '';
    return 'th-custom';
  };

  // -- render ---------------------------------------------------------------

  return (
    <DndContext
      id={`${tableClassName || 'board'}-table-dnd`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="table-wrapper overflow-x-auto">
        <table className={tableClassName}>
          <thead>
            <tr>
              <SortableContext items={localOrder} strategy={horizontalListSortingStrategy}>
                {localOrder.map((colId) => (
                  <SortableHeader key={colId} id={colId} className={getHeaderClass(colId)}>
                    {getHeaderLabel(colId)}
                  </SortableHeader>
                ))}
              </SortableContext>
              {getDateAdded && <th className="th-date">{dateAddedLabel}</th>}
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const id = getItemId(item);
              const isHighlighted = id === highlightId;
              return (
                <tr
                  key={id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(id, node);
                    else rowRefs.current.delete(id);
                  }}
                  className={`group ${deleting === id ? 'row-deleting' : ''} ${isHighlighted ? 'row-highlight' : ''}`}
                  onAnimationEnd={isHighlighted ? onHighlightDone : undefined}
                >
                  {localOrder.map((colId) => renderCell(item, colId))}
                  {getDateAdded && (
                    <td className="td-date">
                      <span className="date-text">{getDateAdded(item)}</span>
                    </td>
                  )}
                  <td className="td-actions">
                    <button
                      type="button"
                      onClick={() => handleDelete(id)}
                      disabled={deleting === id}
                      className="delete-btn"
                      title="Delete"
                      aria-label="Delete"
                    >
                      {TrashIcon}
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
