'use client';

import { useState, useEffect } from 'react';
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
import type { Column } from '@/lib/markdown';
import { DropdownOptionsEditor, type OptionEntry } from './DropdownOptionsEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardColumnManagerProps {
  columns: Column[];
  prebuiltColumns?: Column[];
  prebuiltDescriptions?: Record<string, string>;
  extraToggles?: {
    label: string;
    description: string;
    active: boolean;
    onToggle: () => void;
  }[];
  onAddColumn: (column: Column) => Promise<boolean>;
  onEditColumn: (oldName: string, column: Column) => Promise<boolean>;
  onDeleteColumn: (name: string) => Promise<boolean>;
  onReorderColumns: (names: string[]) => Promise<boolean>;
}

type EditingColumn = {
  originalName: string;
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'date';
  options: OptionEntry[];
};

// ---------------------------------------------------------------------------
// Sortable chip
// ---------------------------------------------------------------------------

function SortableColumnChip({
  column,
  onEdit,
  onDelete,
  isDeleting,
}: {
  column: Column;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.name,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="chip group flex items-center gap-2 pr-1">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-accent-soft rounded touch-none"
        title="Drag to reorder"
      >
        <svg
          className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-muted-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>
      <span className="font-medium">{column.name}</span>
      <span className="opacity-70">({column.type})</span>
      <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1 rounded hover:bg-accent-soft active:bg-accent-soft"
          title="Edit column"
        >
          <svg
            className="w-3.5 h-3.5 sm:w-3 sm:h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="p-1 rounded hover:bg-danger-soft active:bg-danger-soft text-danger disabled:opacity-50"
          title="Delete column"
        >
          <svg
            className="w-3.5 h-3.5 sm:w-3 sm:h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BoardColumnManager
// ---------------------------------------------------------------------------

export function BoardColumnManager({
  columns,
  prebuiltColumns,
  prebuiltDescriptions,
  extraToggles,
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
  onReorderColumns,
}: BoardColumnManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<EditingColumn | null>(null);
  const [deletingCol, setDeletingCol] = useState<string | null>(null);
  const [localColumns, setLocalColumns] = useState(columns);

  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'text' | 'checkbox' | 'dropdown' | 'date'>('text');
  const [newOptions, setNewOptions] = useState<OptionEntry[]>([{ value: '' }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localColumns.findIndex((c) => c.name === active.id);
      const newIndex = localColumns.findIndex((c) => c.name === over.id);
      const reordered = arrayMove(localColumns, oldIndex, newIndex);
      setLocalColumns(reordered);

      const ok = await onReorderColumns(reordered.map((c) => c.name));
      if (!ok) {
        setLocalColumns(columns);
        setError('Failed to reorder columns');
      }
    }
  };

  // Prebuilt columns
  const addedNames = new Set(columns.map((c) => c.name));
  const availablePrebuilt = prebuiltColumns?.filter((c) => !addedNames.has(c.name)) ?? [];

  const handleAddPrebuilt = async (col: Column) => {
    setError(null);
    setLoading(true);
    const ok = await onAddColumn(col);
    if (!ok) setError('Failed to add column');
    setLoading(false);
  };

  // Add custom column
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const column: Column = {
      name: newName.trim(),
      type: newType,
    };

    if (newType === 'dropdown') {
      const opts = newOptions.map((o) => o.value.trim()).filter(Boolean);
      if (opts.length === 0) {
        setError('Dropdown columns need at least one option');
        setLoading(false);
        return;
      }
      column.options = opts;
      const colors: Record<string, string> = {};
      for (const o of newOptions) {
        if (o.value.trim() && o.color) {
          colors[o.value.trim()] = o.color;
        }
      }
      if (Object.keys(colors).length > 0) {
        column.optionColors = colors;
      }
    }

    const ok = await onAddColumn(column);
    if (ok) {
      setNewName('');
      setNewType('text');
      setNewOptions([{ value: '' }]);
      setIsAdding(false);
    } else {
      setError('Failed to add column');
    }
    setLoading(false);
  };

  // Edit column
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    setError(null);

    const column: Column = {
      name: editing.name.trim(),
      type: editing.type,
    };

    if (editing.type === 'dropdown') {
      const opts = editing.options.map((o) => o.value.trim()).filter(Boolean);
      if (opts.length === 0) {
        setError('Dropdown columns need at least one option');
        setLoading(false);
        return;
      }
      column.options = opts;
      const colors: Record<string, string> = {};
      for (const o of editing.options) {
        if (o.value.trim() && o.color) {
          colors[o.value.trim()] = o.color;
        }
      }
      if (Object.keys(colors).length > 0) {
        column.optionColors = colors;
      }
    }

    const ok = await onEditColumn(editing.originalName, column);
    if (ok) {
      setEditing(null);
    } else {
      setError('Failed to update column');
    }
    setLoading(false);
  };

  // Delete column
  const handleDelete = async (columnName: string) => {
    if (!confirm(`Delete column "${columnName}"? This will remove this field from all entries.`)) {
      return;
    }
    setDeletingCol(columnName);
    setError(null);
    const ok = await onDeleteColumn(columnName);
    if (!ok) setError('Failed to delete column');
    setDeletingCol(null);
  };

  const startEdit = (col: Column) => {
    setEditing({
      originalName: col.name,
      name: col.name,
      type: col.type,
      options: col.options?.map((v) => ({ value: v, color: col.optionColors?.[v] })) || [
        { value: '' },
      ],
    });
    setIsAdding(false);
    setError(null);
  };

  // Determine if we should show the prebuilt/custom panel
  const hasPrebuilt = availablePrebuilt.length > 0;
  const hasToggles = extraToggles && extraToggles.some((t) => !t.active);

  return (
    <div className="mb-6 sm:mb-8">
      {error && <div className="callout callout-error mb-3">{error}</div>}

      {/* Edit form */}
      {editing && (
        <div className="card p-5 mb-3">
          <h3 className="text-base font-semibold mb-3">Edit column</h3>
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Column name</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={editing.type}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    type: e.target.value as 'text' | 'checkbox' | 'dropdown' | 'date',
                  })
                }
                className="select w-full"
              >
                <option value="text">Text</option>
                <option value="checkbox">Checkbox (Yes/No)</option>
                <option value="dropdown">Dropdown</option>
                <option value="date">Date</option>
              </select>
            </div>
            {editing.type === 'dropdown' && (
              <DropdownOptionsEditor
                options={editing.options}
                onChange={(opts) => setEditing({ ...editing, options: opts })}
              />
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !editing.name.trim()}
                className="btn btn-primary"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setError(null);
                }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add form */}
      {isAdding ? (
        <div className="card p-5 mb-3">
          <h3 className="text-base font-semibold mb-3">Add custom column</h3>

          {/* Prebuilt columns section */}
          {(hasPrebuilt || hasToggles) && (
            <div className="mb-4">
              <p className="text-xs font-medium muted uppercase tracking-wider mb-2">Pre-built</p>
              <div className="space-y-1.5">
                {availablePrebuilt.map((col) => (
                  <button
                    key={col.name}
                    onClick={() => handleAddPrebuilt(col)}
                    disabled={loading}
                    className="prebuilt-col-btn"
                  >
                    <div>
                      <span className="prebuilt-col-name">{col.name}</span>
                      <span className="prebuilt-col-type block">
                        {prebuiltDescriptions?.[col.name] || col.type}
                      </span>
                    </div>
                  </button>
                ))}
                {extraToggles
                  ?.filter((t) => !t.active)
                  .map((toggle) => (
                    <button
                      key={toggle.label}
                      onClick={toggle.onToggle}
                      disabled={loading}
                      className="prebuilt-col-btn"
                    >
                      <div>
                        <span className="prebuilt-col-name">{toggle.label}</span>
                        <span className="prebuilt-col-type block">{toggle.description}</span>
                      </div>
                    </button>
                  ))}
              </div>
              <p className="text-xs font-medium muted uppercase tracking-wider mb-2 mt-4">Custom</p>
            </div>
          )}

          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Column name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Salary, Referral"
                required
                className="input"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as 'text' | 'checkbox' | 'dropdown' | 'date')
                }
                className="select w-full"
              >
                <option value="text">Text</option>
                <option value="checkbox">Checkbox (Yes/No)</option>
                <option value="dropdown">Dropdown</option>
                <option value="date">Date</option>
              </select>
            </div>
            {newType === 'dropdown' && (
              <DropdownOptionsEditor options={newOptions} onChange={setNewOptions} />
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !newName.trim()}
                className="btn btn-primary"
              >
                {loading ? 'Adding...' : 'Add column'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setError(null);
                }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        !editing && (
          <button onClick={() => setIsAdding(true)} className="btn btn-soft text-sm mb-3">
            + Add custom column
          </button>
        )
      )}

      {/* Column chips with DnD + active toggle chips */}
      {(localColumns.length > 0 || extraToggles?.some((t) => t.active)) && (
        <DndContext
          id="board-column-manager-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localColumns.map((c) => c.name)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-wrap gap-2">
              {localColumns.map((col) => (
                <SortableColumnChip
                  key={col.name}
                  column={col}
                  onEdit={() => startEdit(col)}
                  onDelete={() => handleDelete(col.name)}
                  isDeleting={deletingCol === col.name}
                />
              ))}
              {extraToggles
                ?.filter((t) => t.active)
                .map((toggle) => (
                  <div key={toggle.label} className="chip flex items-center gap-2 pr-1">
                    <span className="font-medium">{toggle.label}</span>
                    <button
                      onClick={toggle.onToggle}
                      className="p-1 rounded hover:bg-danger-soft active:bg-danger-soft text-danger"
                      title={`Remove ${toggle.label}`}
                    >
                      <svg
                        className="w-3.5 h-3.5 sm:w-3 sm:h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
