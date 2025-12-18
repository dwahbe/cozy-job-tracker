'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AddColumnFormProps {
  slug: string;
}

export function AddColumnForm({ slug }: AddColumnFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'checkbox' | 'dropdown'>('text');
  const [options, setOptions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const column: { name: string; type: string; options?: string[] } = {
        name: name.trim(),
        type,
      };

      if (type === 'dropdown') {
        const opts = options
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

      // Reset and close
      setName('');
      setType('text');
      setOptions('');
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="btn btn-soft text-sm">
        + Add custom column
      </button>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold tracking-tight mb-4">Add custom column</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Column name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Salary, Referral"
            required
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'text' | 'checkbox' | 'dropdown')}
            className="select"
          >
            <option value="text">Text</option>
            <option value="checkbox">Checkbox (Yes/No)</option>
            <option value="dropdown">Dropdown</option>
          </select>
        </div>

        {type === 'dropdown' && (
          <div>
            <label className="block text-sm font-medium mb-1">Options (comma-separated)</label>
            <input
              type="text"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="e.g., Low, Medium, High"
              className="input"
            />
          </div>
        )}

        {error && <div className="callout callout-error">{error}</div>}

        <div className="flex gap-2">
          <button type="submit" disabled={loading || !name.trim()} className="btn btn-primary">
            {loading ? 'Adding...' : 'Add Column'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setError(null);
            }}
            className="btn btn-ghost"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
