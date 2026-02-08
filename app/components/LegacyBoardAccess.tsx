'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LegacyBoardAccess() {
  const [slug, setSlug] = useState('');
  const router = useRouter();

  function handleGo(e: React.FormEvent) {
    e.preventDefault();
    const clean = slug.trim().toLowerCase();
    if (clean) {
      router.push(`/b/${clean}`);
    }
  }

  return (
    <form onSubmit={handleGo} className="flex items-center gap-2">
      <span className="text-sm muted whitespace-nowrap">/b/</span>
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="your-board-name"
        className="input flex-1"
        pattern="[a-z0-9-]+"
        title="Lowercase letters, numbers, and hyphens only"
      />
      <button type="submit" disabled={!slug.trim()} className="btn text-sm whitespace-nowrap">
        go
      </button>
    </form>
  );
}
