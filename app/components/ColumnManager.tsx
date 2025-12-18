'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface ColumnManagerProps {
  slug: string;
  columns: Column[];
}

type EditingColumn = {
  originalName: string;
  name: string;
  type: 'text' | 'checkbox' | 'dropdown';
  options: string;
};

// Sortable column chip component
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
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-amber-100 rounded touch-none"
        title="Drag to reorder"
      >
        <svg
          className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-gray-400"
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
          className="p-1 rounded hover:bg-amber-100 active:bg-amber-100"
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
          className="p-1 rounded hover:bg-red-100 active:bg-red-100 text-red-600 disabled:opacity-50"
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

export function ColumnManager({ slug, columns }: ColumnManagerProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<EditingColumn | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localColumns, setLocalColumns] = useState(columns);

  // Sync local state when columns prop changes
  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'text' | 'checkbox' | 'dropdown'>('text');
  const [newOptions, setNewOptions] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Handle drag end - reorder custom columns
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localColumns.findIndex((col) => col.name === active.id);
      const newIndex = localColumns.findIndex((col) => col.name === over.id);

      const newColumns = arrayMove(localColumns, oldIndex, newIndex);
      setLocalColumns(newColumns);

      // Save new order to server
      try {
        const response = await fetch('/api/manage-column', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            columnOrder: newColumns.map((c) => c.name),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to reorder columns');
          setLocalColumns(columns); // Revert on error
          return;
        }

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reorder columns');
        setLocalColumns(columns); // Revert on error
      }
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const column: { name: string; type: string; options?: string[] } = {
        name: newName.trim(),
        type: newType,
      };

      if (newType === 'dropdown') {
        const opts = newOptions
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        if (opts.length === 0) {
          setError('Dropdown columns need at least one option');
          setLoading(false);
          return;
        }
        column.options = opts;
      }

      const response = await fetch('/api/add-column', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, column }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to add column');
        return;
      }

      setNewName('');
      setNewType('text');
      setNewOptions('');
      setIsAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    setLoading(true);
    setError(null);

    try {
      const column: { name: string; type: string; options?: string[] } = {
        name: editing.name.trim(),
        type: editing.type,
      };

      if (editing.type === 'dropdown') {
        const opts = editing.options
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        if (opts.length === 0) {
          setError('Dropdown columns need at least one option');
          setLoading(false);
          return;
        }
        column.options = opts;
      }

      const response = await fetch('/api/manage-column', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, oldName: editing.originalName, column }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to update column');
        return;
      }

      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update column');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (columnName: string) => {
    if (!confirm(`Delete column "${columnName}"? This will remove this field from all jobs.`)) {
      return;
    }

    setDeleting(columnName);
    setError(null);

    try {
      const response = await fetch(
        `/api/manage-column?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(columnName)}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to delete column');
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete column');
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (col: Column) => {
    setEditing({
      originalName: col.name,
      name: col.name,
      type: col.type,
      options: col.options?.join(', ') || '',
    });
    setIsAdding(false);
    setError(null);
  };

  return (
    <div className="mb-6 sm:mb-8">
      {/* Error message */}
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
                    type: e.target.value as 'text' | 'checkbox' | 'dropdown',
                  })
                }
                className="select w-full"
              >
                <option value="text">Text</option>
                <option value="checkbox">Checkbox (Yes/No)</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>

            {editing.type === 'dropdown' && (
              <div>
                <label className="block text-sm font-medium mb-1">Options (comma-separated)</label>
                <input
                  type="text"
                  value={editing.options}
                  onChange={(e) => setEditing({ ...editing, options: e.target.value })}
                  placeholder="e.g., Low, Medium, High"
                  className="input"
                />
              </div>
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'text' | 'checkbox' | 'dropdown')}
                className="select w-full"
              >
                <option value="text">Text</option>
                <option value="checkbox">Checkbox (Yes/No)</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>

            {newType === 'dropdown' && (
              <div>
                <label className="block text-sm font-medium mb-1">Options (comma-separated)</label>
                <input
                  type="text"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="e.g., Low, Medium, High"
                  className="input"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !newName.trim()}
                className="btn btn-primary"
              >
                {loading ? 'Adding...' : 'Add Column'}
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

      {/* Column list with drag and drop */}
      {localColumns.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                  isDeleting={deleting === col.name}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
