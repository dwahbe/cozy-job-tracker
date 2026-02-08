'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface LegacyBoard {
  slug: string;
  title: string;
  hasPin: boolean;
}

export function ImportBoardModal({ onClose }: { onClose: () => void }) {
  const [boards, setBoards] = useState<LegacyBoard[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const selectedBoard = boards.find((b) => b.slug === selectedSlug);

  useEffect(() => {
    fetch('/api/list-legacy-boards')
      .then((res) => res.json())
      .then((data) => {
        setBoards(data.boards || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load boards');
        setLoading(false);
      });
  }, []);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  function handleBoardChange(slug: string) {
    setSelectedSlug(slug);
    setPin('');
    setError('');
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlug) return;

    if (selectedBoard?.hasPin && !pin) {
      setError('PIN is required for this board');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const res = await fetch('/api/claim-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selectedSlug, pin: pin || undefined }),
      });

      const data = await res.json();

      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(data.error || 'Failed to import board');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="card w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import existing board</h2>
          <button onClick={onClose} className="muted hover:opacity-70 cursor-pointer p-1">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="muted text-sm py-4 text-center">Loading boards...</p>
        ) : boards.length === 0 ? (
          <div className="py-4 text-center">
            <p className="muted text-sm">No boards available to import.</p>
            <p className="muted text-sm mt-1">All existing boards have already been migrated.</p>
          </div>
        ) : (
          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label htmlFor="board-select" className="block text-sm font-medium mb-1.5">
                Select a board
              </label>
              <select
                id="board-select"
                value={selectedSlug}
                onChange={(e) => handleBoardChange(e.target.value)}
                className="input w-full"
                required
              >
                <option value="">Choose a board...</option>
                {boards.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.title} (/b/{b.slug}){b.hasPin ? ' 🔒' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedBoard?.hasPin && (
              <div>
                <label htmlFor="board-pin" className="block text-sm font-medium mb-1.5">
                  Board PIN
                </label>
                <input
                  id="board-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4,6}"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter PIN"
                  required
                  className="input w-full"
                  maxLength={6}
                />
                <p className="text-xs muted mt-1">
                  This board is PIN-protected. Enter the PIN to import it.
                </p>
              </div>
            )}

            <p className="text-sm muted">
              This will copy all jobs from the selected board into your account.
            </p>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={importing || !selectedSlug || (selectedBoard?.hasPin && !pin)}
                className="btn btn-primary text-sm"
              >
                {importing ? 'Importing...' : 'Import board'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm muted hover:underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
