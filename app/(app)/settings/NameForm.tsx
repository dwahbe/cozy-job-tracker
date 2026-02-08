'use client';

import { useState } from 'react';

export function NameForm({ currentName }: { currentName: string | null }) {
  const [name, setName] = useState(currentName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const res = await fetch('/api/update-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
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
        <label htmlFor="display-name" className="block text-sm muted mb-1.5">
          Display name
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input w-full"
          placeholder="Your name"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || name.trim() === (currentName || '')}
          className="btn btn-primary text-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && <span className="text-sm text-success">Saved!</span>}
      </div>
    </form>
  );
}
