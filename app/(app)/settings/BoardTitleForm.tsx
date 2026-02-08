'use client';

import { useState } from 'react';

export function BoardTitleForm({ currentTitle }: { currentTitle: string }) {
  const [title, setTitle] = useState(currentTitle);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const res = await fetch('/api/update-board-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
          className="input w-full"
          placeholder="My job board"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || title === currentTitle}
          className="btn btn-primary text-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && <span className="text-sm text-success">Saved!</span>}
      </div>
    </form>
  );
}
