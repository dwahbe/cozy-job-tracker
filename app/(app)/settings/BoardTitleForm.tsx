'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOARD_TITLE_MAX } from '@/lib/limits';

export function BoardTitleForm({ currentTitle }: { currentTitle: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(currentTitle);
  // What the server has, so the button re-enables correctly after a save.
  const [savedTitle, setSavedTitle] = useState(currentTitle);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch('/api/update-board-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (res.ok) {
        const trimmed = title.trim();
        setSavedTitle(trimmed);
        setTitle(trimmed);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to save title. Please try again.');
      }
    } catch {
      setError('Failed to save title. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label htmlFor="board-title" className="block text-sm muted mb-1.5">
          Board title
        </label>
        <input
          id="board-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={BOARD_TITLE_MAX}
          className="input w-full"
          placeholder="My job board"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !title.trim() || title.trim() === savedTitle}
          className="btn btn-primary text-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && (
          <span className="text-sm text-success" role="status">
            Saved!
          </span>
        )}
        {error && (
          <span className="text-sm text-danger" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
