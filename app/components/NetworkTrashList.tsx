'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TrashedPerson } from '@/lib/network';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function daysUntilPermanentDelete(dateStr: string): number {
  const deletedAt = new Date(dateStr).getTime();
  const expiresAt = deletedAt + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

interface NetworkTrashListProps {
  items: TrashedPerson[];
}

export function NetworkTrashList({ items }: NetworkTrashListProps) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);

  const handleRestore = async (personId: string) => {
    setRestoring(personId);
    try {
      const response = await fetch('/api/network/restore-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      });
      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setRestoring(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm("Permanently delete all items in trash? This can't be undone.")) return;

    setEmptying(true);
    try {
      const response = await fetch('/api/network/empty-trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Empty trash failed:', err);
    } finally {
      setEmptying(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🗑️</p>
        <p className="text-lg font-medium mb-1">Trash is empty</p>
        <p className="text-sm muted">Deleted people will appear here for 30 days</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
          <p className="text-xs muted">Items are auto-deleted after 30 days</p>
        </div>
        <button
          onClick={handleEmptyTrash}
          disabled={emptying}
          className="btn btn-sm text-danger hover:bg-danger-soft transition-colors"
        >
          {emptying ? 'Emptying...' : 'Empty trash'}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((person) => {
          const daysLeft = daysUntilPermanentDelete(person.deletedAt);
          const isRestoringThis = restoring === person.id;

          return (
            <div
              key={person.id}
              className={`card p-4 flex items-center justify-between gap-4 ${isRestoringThis ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold truncate">{person.name}</h3>
                  {person.company && (
                    <span className="text-xs muted shrink-0">at {person.company}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs muted">
                  <span>Deleted {timeAgo(person.deletedAt)}</span>
                  <span className={daysLeft <= 3 ? 'text-danger font-medium' : ''}>
                    {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRestore(person.id)}
                disabled={isRestoringThis}
                className="btn btn-sm btn-soft shrink-0"
              >
                {isRestoringThis ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
